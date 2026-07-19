// =====================================================
// Aegis - Healer Service Entry Point
// =====================================================

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { DecisionEngine } from './decision-engine';
import { HealingActions } from './actions';
import { createChaosRouter } from './chaos-api';
import { createLogger } from '../shared/logger';
import { HealingLogEntry, Anomaly, HealingActionType } from '../shared/types';

const logger = createLogger('Healer');
const app = express();
const PORT = process.env.HEALER_PORT || 4001;
const MONITOR_URL = process.env.MONITOR_URL || 'http://monitor:4000';
const EVALUATOR_URL = process.env.EVALUATOR_URL || 'http://evaluator:4002';

// When true (on the hosted public demo), the manual /heal override requires
// an admin token and only accepts known action types instead of anything
// a caller sends.
const PUBLIC_DEMO = process.env.PUBLIC_DEMO === 'true';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const VALID_ACTION_TYPES: HealingActionType[] = [
  'restart', 'scale_up', 'scale_down', 'remove_from_routing',
  'add_to_routing', 'update_config', 'throttle', 'no_action',
];

// Initialize components
const decisionEngine = new DecisionEngine();
const healingActions = new HealingActions();

// Healing statistics
const stats = {
  totalDecisions: 0,
  successfulHealings: 0,
  failedHealings: 0,
  startTime: new Date(),
};

app.use(cors());
app.use(express.json());

// Safe, allowlisted, rate-limited chaos injection for public callers
app.use('/chaos', createChaosRouter(healingActions));

// =====================================================
// Healing Loop
// =====================================================
async function healingLoop(): Promise<void> {
  try {
    // Fetch anomalies from monitor
    const response = await axios.get(`${MONITOR_URL}/anomalies`);
    const { anomalies } = response.data;

    if (anomalies.length === 0) {
      return;
    }

    logger.info(`Processing ${anomalies.length} anomalies`);

    // Group anomalies by service
    const anomaliesByService = new Map<string, Anomaly[]>();
    for (const anomaly of anomalies) {
      const existing = anomaliesByService.get(anomaly.serviceName) || [];
      existing.push(anomaly);
      anomaliesByService.set(anomaly.serviceName, existing);
    }

    // Process each service
    for (const [serviceName, serviceAnomalies] of anomaliesByService) {
      await processServiceAnomalies(serviceName, serviceAnomalies);
    }

  } catch (error) {
    if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
      logger.debug('Monitor not available yet, waiting...');
    } else {
      logger.error('Error in healing loop', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
}

/**
 * Process anomalies for a specific service
 */
async function processServiceAnomalies(
  serviceName: string,
  anomalies: Anomaly[]
): Promise<void> {
  // Make healing decision
  const decision = decisionEngine.makeDecision(serviceName, anomalies);

  if (!decision) {
    return;
  }

  stats.totalDecisions++;

  // Tell the evaluator healing is starting now, so it can measure real
  // MTTD/MTTR from this exact moment instead of guessing via polling.
  // Fire-and-forget: never let evaluator being unreachable break healing.
  axios.post(`${EVALUATOR_URL}/incidents/healing-started`, { serviceName }).catch(() => {});

  // Execute healing action
  const startTime = Date.now();
  const result = await healingActions.execute(decision.action);
  const executionTime = Date.now() - startTime;

  // Set cooldown if action was taken
  if (decision.action.type === 'restart') {
    decisionEngine.setCooldown(serviceName);
  }

  // Log the healing event
  const logEntry: HealingLogEntry = {
    id: uuidv4(),
    time: new Date().toLocaleTimeString(),
    service: serviceName,
    symptoms: anomalies.map(a => a.type.replace('_', ' ')),
    root_cause: decision.rootCause.primary,
    action: decision.action.type,
    confidence: decision.confidence,
    details: {
      anomalies,
      decision,
      executionTime,
      success: result.success,
      error: result.success ? undefined : result.message,
    },
  };

  // Write to healing log
  logger.logHealing(logEntry);

  // Update stats
  if (result.success) {
    stats.successfulHealings++;
  } else {
    stats.failedHealings++;
  }
}

// Start healing loop (check every 5 seconds)
setInterval(healingLoop, 5000);

// Initial run after delay (wait for monitor to start)
setTimeout(healingLoop, 10000);

// =====================================================
// API Endpoints
// =====================================================

// Get healer status
app.get('/status', (req, res) => {
  const uptime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000);
  
  res.json({
    status: 'running',
    uptime,
    stats: {
      totalDecisions: stats.totalDecisions,
      successfulHealings: stats.successfulHealings,
      failedHealings: stats.failedHealings,
      successRate: stats.totalDecisions > 0
        ? ((stats.successfulHealings / stats.totalDecisions) * 100).toFixed(2) + '%'
        : 'N/A',
    },
  });
});

// Get the most recent healing log entries across all services (explainability feed)
app.get('/healing-log', (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10) || 20, 100);
  const logs = logger.getRecentHealingLogs(limit);
  res.json({ count: logs.length, logs });
});

// Get decision history for a service
app.get('/decisions/:serviceName', (req, res) => {
  const { serviceName } = req.params;
  const history = decisionEngine.getDecisionHistory(serviceName);
  
  res.json({
    serviceName,
    count: history.length,
    decisions: history.map(d => ({
      id: d.id,
      timestamp: d.timestamp,
      action: d.action.type,
      rootCause: d.rootCause.primary,
      confidence: d.confidence,
      symptoms: d.symptoms.map(s => s.type),
    })),
  });
});

// Manually trigger healing for a service
app.post('/heal/:serviceName', async (req, res) => {
  const { serviceName } = req.params;
  const { action } = req.body;

  if (!action) {
    res.status(400).json({ error: 'Action type required' });
    return;
  }

  if (PUBLIC_DEMO) {
    const token = req.header('X-Admin-Token');
    if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) {
      res.status(401).json({ error: 'Admin token required for manual healing on the public demo' });
      return;
    }
    if (!VALID_ACTION_TYPES.includes(action)) {
      res.status(400).json({ error: `action must be one of: ${VALID_ACTION_TYPES.join(', ')}` });
      return;
    }
  }

  const result = await healingActions.execute({
    type: action,
    serviceName,
    parameters: req.body.parameters || {},
  });

  res.json(result);
});

// Get container status
app.get('/containers', async (req, res) => {
  const containers = await healingActions.listContainers();
  res.json({ containers });
});

// Get container stats
app.get('/containers/:name/stats', async (req, res) => {
  const { name } = req.params;
  const containerStats = await healingActions.getContainerStats(name);
  
  if (!containerStats) {
    res.status(404).json({ error: `Container ${name} not found` });
    return;
  }

  res.json(containerStats);
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'aegis-healer',
    timestamp: new Date().toISOString(),
  });
});

// =====================================================
// Start Server
// =====================================================
app.listen(PORT, () => {
  logger.info(`🩺 Aegis Healer running on port ${PORT}`);
  logger.info(`   Monitor URL: ${MONITOR_URL}`);
});

export { decisionEngine, healingActions, stats };
