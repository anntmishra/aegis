import express from 'express';
import cors from 'cors';
import { MetricsCollector } from './metrics-collector';
import { AnomalyDetector } from './anomaly-detector';
import { createLogger } from '../shared/logger';
import { MONITOR_CONFIG } from '../shared/config';
import { Anomaly, ServiceMetrics } from '../shared/types';

const logger = createLogger('Monitor');
const app = express();
const PORT = process.env.MONITOR_PORT || 4000;

app.use(cors());

const metricsCollector = new MetricsCollector();
const anomalyDetector = new AnomalyDetector(MONITOR_CONFIG.anomalyThresholds);

let currentAnomalies: Map<string, Anomaly[]> = new Map();
let latestMetrics: Map<string, ServiceMetrics> = new Map();

app.use(express.json());

async function monitoringLoop(): Promise<void> {
  logger.info('Starting monitoring cycle...');

  try {
    const metrics = await metricsCollector.collectAllMetrics();
    latestMetrics = metrics;

    const allAnomalies = new Map<string, Anomaly[]>();

    for (const [serviceName, serviceMetrics] of metrics) {
      const anomalies = anomalyDetector.detectAnomalies(serviceMetrics);
      if (anomalies.length > 0) {
        allAnomalies.set(serviceName, anomalies);
      }
    }

    currentAnomalies = allAnomalies;

    const totalAnomalies = Array.from(allAnomalies.values()).flat().length;
    if (totalAnomalies > 0) {
      logger.warn(`Monitoring cycle complete: ${totalAnomalies} anomalies detected`);
    } else {
      logger.debug('Monitoring cycle complete: all services healthy');
    }

  } catch (error) {
    logger.error('Error in monitoring cycle', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

setInterval(monitoringLoop, MONITOR_CONFIG.pollInterval);
monitoringLoop();

app.get('/status', (req, res) => {
  const status: Record<string, any> = {};
  
  for (const [serviceName, metrics] of latestMetrics) {
    const anomalies = currentAnomalies.get(serviceName) || [];
    status[serviceName] = {
      metrics: {
        latency: metrics.latency,
        errorRate: metrics.errorRate,
        memory: metrics.memory,
        uptime: metrics.uptime,
      },
      anomalies: anomalies.map(a => ({
        type: a.type,
        severity: a.severity,
        description: a.description,
      })),
      health: anomalies.length === 0 ? 'healthy' : 
              anomalies.some(a => a.severity === 'critical') ? 'critical' : 'degraded',
    };
  }

  res.json({
    timestamp: new Date().toISOString(),
    services: status,
    totalAnomalies: Array.from(currentAnomalies.values()).flat().length,
  });
});

app.get('/anomalies', (req, res) => {
  const anomalyList: any[] = [];
  
  for (const [serviceName, anomalies] of currentAnomalies) {
    for (const anomaly of anomalies) {
      anomalyList.push({
        ...anomaly,
        symptoms: anomalyDetector.translateToSymptoms([anomaly]),
      });
    }
  }

  res.json({
    timestamp: new Date().toISOString(),
    count: anomalyList.length,
    anomalies: anomalyList,
  });
});

app.get('/metrics/:serviceName', (req, res) => {
  const { serviceName } = req.params;
  const metrics = latestMetrics.get(serviceName);
  
  if (!metrics) {
    res.status(404).json({ error: `Service ${serviceName} not found` });
    return;
  }

  const history = metricsCollector.getMetricsHistory(serviceName, 100);
  
  res.json({
    current: metrics,
    history: history.map(m => ({
      timestamp: m.timestamp,
      latency: m.latency.p95,
      errorRate: m.errorRate,
      memory: m.memory.percentage,
    })),
  });
});

app.get('/baselines/:serviceName', (req, res) => {
  const { serviceName } = req.params;
  const baselines = anomalyDetector.getServiceBaselines(serviceName);
  
  if (!baselines) {
    res.status(404).json({ error: `No baselines for ${serviceName}` });
    return;
  }

  const result: Record<string, any> = {};
  for (const [metric, baseline] of baselines) {
    result[metric] = {
      mean: baseline.mean,
      stdDev: baseline.stdDev,
      ewma: baseline.ewma,
      sampleCount: baseline.sampleCount,
    };
  }

  res.json(result);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'aegis-monitor',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  logger.info(`🔍 Aegis Monitor running on port ${PORT}`);
  logger.info(`   Poll interval: ${MONITOR_CONFIG.pollInterval}ms`);
  logger.info(`   Monitoring ${MONITOR_CONFIG.services.length} services`);
});

export { metricsCollector, anomalyDetector, currentAnomalies, latestMetrics };
