import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { Evaluator } from './evaluator';
import { createLogger } from '../shared/logger';

const logger = createLogger('EvaluatorService');
const app = express();
const PORT = process.env.EVALUATOR_PORT || 4002;
const MONITOR_URL = process.env.MONITOR_URL || 'http://monitor:4000';

const evaluator = new Evaluator();

app.use(cors());
app.use(express.json());

const serviceStates: Map<string, 'healthy' | 'unhealthy'> = new Map();

async function evaluationLoop(): Promise<void> {
  try {
    const statusResponse = await axios.get(`${MONITOR_URL}/status`);
    const { services } = statusResponse.data;

    for (const [serviceName, serviceData] of Object.entries(services) as any) {
      const previousState = serviceStates.get(serviceName) || 'healthy';
      const currentHealth = serviceData.health;
      const anomalies = serviceData.anomalies || [];

      if (currentHealth !== 'healthy' && previousState === 'healthy') {
        evaluator.recordDetection(serviceName, anomalies);
      }

      if (currentHealth === 'healthy' && previousState !== 'healthy') {
        evaluator.recordRecovery(serviceName, true);
      }

      serviceStates.set(serviceName, currentHealth === 'healthy' ? 'healthy' : 'unhealthy');
    }

  } catch (error) {
    if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
      logger.debug('Services not available yet, waiting...');
    } else {
      logger.error('Error in evaluation loop', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

setInterval(evaluationLoop, 5000);
setTimeout(evaluationLoop, 5000);

// Called by the healer the moment it decides to act on a service, so MTTD
// (detection -> healing start) and MTTR (healing start -> recovery) are
// measured from the real event instead of guessed at via polling.
app.post('/incidents/healing-started', (req, res) => {
  const { serviceName } = req.body;
  if (!serviceName) {
    res.status(400).json({ error: 'serviceName required' });
    return;
  }
  evaluator.recordHealingStart(serviceName);
  res.json({ ok: true });
});

app.get('/metrics', (req, res) => {
  const metrics = evaluator.calculateMetrics();
  res.json({
    timestamp: new Date().toISOString(),
    ...metrics,
  });
});

app.get('/snapshot', (req, res) => {
  const snapshot = evaluator.getSnapshot();
  res.json(snapshot);
});

app.get('/incidents/active', (req, res) => {
  const incidents = evaluator.getActiveIncidents();
  res.json({
    count: incidents.length,
    incidents,
  });
});

app.get('/incidents/history', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const incidents = evaluator.getIncidentHistory(limit);
  res.json({
    count: incidents.length,
    incidents,
  });
});

app.get('/timeline', (req, res) => {
  const bucketSize = parseInt(req.query.bucket as string) || 300000;
  const timeline = evaluator.getMetricsTimeline(bucketSize);
  res.json({
    bucketSize,
    dataPoints: timeline.length,
    timeline,
  });
});

app.get('/services', (req, res) => {
  const serviceMetrics = evaluator.getServiceMetrics();
  res.json(serviceMetrics);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'aegis-evaluator',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  logger.info(`📊 Aegis Evaluator running on port ${PORT}`);
});

export { evaluator };
