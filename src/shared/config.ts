// =====================================================
// Aegis Self-Healing System - Configuration
// =====================================================

import { MonitorConfig, AnomalyThresholds } from './types';

// Default anomaly detection thresholds
export const DEFAULT_THRESHOLDS: AnomalyThresholds = {
  latencyZScore: 2.0,        // Flag if latency > mean + 2*stdDev
  errorRateThreshold: 5.0,   // Flag if error rate > 5%
  memoryThreshold: 85.0,     // Flag if memory usage > 85%
  cpuThreshold: 80.0,        // Flag if CPU usage > 80%
  ewmaAlpha: 0.3,            // EWMA smoothing factor
};

// Service configuration
export const SERVICES = {
  'service-a': {
    name: 'service-a',
    containerName: 'aegis-service-a',
    host: process.env.SERVICE_A_HOST || 'service-a',
    port: 3000,
    healthUrl: '/health',
    metricsUrl: '/metrics',
  },
  'service-b': {
    name: 'service-b',
    containerName: 'aegis-service-b',
    host: process.env.SERVICE_B_HOST || 'service-b',
    port: 3000,
    healthUrl: '/health',
    metricsUrl: '/metrics',
  },
  'service-c': {
    name: 'service-c',
    containerName: 'aegis-service-c',
    host: process.env.SERVICE_C_HOST || 'service-c',
    port: 3000,
    healthUrl: '/health',
    metricsUrl: '/metrics',
  },
} as const;

// Monitor configuration
export const MONITOR_CONFIG: MonitorConfig = {
  pollInterval: parseInt(process.env.POLL_INTERVAL || '5000', 10),
  services: Object.values(SERVICES).map(s => ({
    name: s.name,
    healthUrl: `http://${s.host}:${s.port}${s.healthUrl}`,
    metricsUrl: `http://${s.host}:${s.port}${s.metricsUrl}`,
  })),
  anomalyThresholds: DEFAULT_THRESHOLDS,
};

// Healing configuration
export const HEALER_CONFIG = {
  maxRestartAttempts: 3,
  restartCooldown: 60000,      // 1 minute cooldown between restarts
  scaleUpThreshold: 2,          // Number of anomalies before scaling up
  scaleDownDelay: 300000,       // 5 minutes before scaling down
  confidenceThreshold: 0.6,     // Minimum confidence to take action
};

// Chaos engineering configuration
export const CHAOS_CONFIG = {
  enabled: process.env.CHAOS_ENABLED === 'true',
  minInterval: 30000,           // Minimum 30 seconds between chaos events
  maxInterval: 120000,          // Maximum 2 minutes between chaos events
  duration: {
    killContainer: 0,           // Instant
    memoryThrottle: 30000,      // 30 seconds
    cpuThrottle: 30000,         // 30 seconds
    networkLatency: 60000,      // 1 minute
  },
};

// Evaluation metrics configuration
export const EVALUATION_CONFIG = {
  windowSize: 3600000,          // 1 hour window for calculations
  sampleInterval: 1000,         // 1 second sample interval
};

export default {
  services: SERVICES,
  monitor: MONITOR_CONFIG,
  healer: HEALER_CONFIG,
  chaos: CHAOS_CONFIG,
  evaluation: EVALUATION_CONFIG,
  thresholds: DEFAULT_THRESHOLDS,
};
