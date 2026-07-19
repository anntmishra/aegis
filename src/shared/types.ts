// =====================================================
// Aegis Self-Healing System - Shared Types
// =====================================================

// Service Health Status
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

// Service Information
export interface ServiceInfo {
  name: string;
  containerId: string;
  host: string;
  port: number;
  status: HealthStatus;
  lastChecked: Date;
}

// Metrics collected from services
export interface ServiceMetrics {
  serviceName: string;
  timestamp: Date;
  latency: LatencyMetrics;
  errorRate: number;           // Percentage (0-100)
  requestRate: number;         // Requests per second
  uptime: number;              // Seconds
  memory: MemoryMetrics;
  cpu: CpuMetrics;
}

export interface LatencyMetrics {
  p50: number;    // 50th percentile (median)
  p95: number;    // 95th percentile
  p99: number;    // 99th percentile
  avg: number;    // Average latency
  min: number;
  max: number;
}

export interface MemoryMetrics {
  used: number;       // Bytes
  limit: number;      // Bytes
  percentage: number; // Percentage used
}

export interface CpuMetrics {
  percentage: number;
}

// Anomaly Types
export type AnomalyType = 
  | 'latency_spike'
  | 'error_burst'
  | 'memory_exhaustion'
  | 'cpu_overload'
  | 'service_down'
  | 'request_flood'
  | 'slow_response';

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Anomaly {
  id: string;
  serviceName: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  timestamp: Date;
  value: number;
  threshold: number;
  baseline: number;
  description: string;
}

// Baseline Statistics for Anomaly Detection
export interface BaselineStats {
  serviceName: string;
  metric: string;
  mean: number;
  stdDev: number;
  ewma: number;           // Exponentially Weighted Moving Average
  sampleCount: number;
  lastUpdated: Date;
}

// Healing Actions
export type HealingActionType = 
  | 'restart'
  | 'scale_up'
  | 'scale_down'
  | 'remove_from_routing'
  | 'add_to_routing'
  | 'update_config'
  | 'throttle'
  | 'no_action';

export interface HealingAction {
  type: HealingActionType;
  serviceName: string;
  parameters?: Record<string, unknown>;
}

// Root Cause Analysis
export interface RootCause {
  primary: string;
  contributing: string[];
  confidence: number;    // 0-1
}

// Healing Decision
export interface HealingDecision {
  id: string;
  timestamp: Date;
  serviceName: string;
  symptoms: Anomaly[];
  rootCause: RootCause;
  action: HealingAction;
  confidence: number;
  reasoning: string;
}

// Explainability Log Entry
export interface HealingLogEntry {
  id: string;
  time: string;
  service: string;
  symptoms: string[];
  root_cause: string;
  action: string;
  confidence: number;
  details: {
    anomalies: Anomaly[];
    decision: HealingDecision;
    executionTime: number;
    success: boolean;
    error?: string;
  };
}

// Evaluation Metrics
export interface EvaluationMetrics {
  mttd: number;           // Mean Time To Detect (seconds)
  mttr: number;           // Mean Time To Recover (seconds)
  successRate: number;    // Percentage of successful recoveries
  totalIncidents: number;
  resolvedIncidents: number;
  falsePositives: number;
}

// Chaos Engineering
export type ChaosType = 
  | 'kill_container'
  | 'memory_throttle'
  | 'cpu_throttle'
  | 'network_latency'
  | 'network_partition'
  | 'disk_fill';

export interface ChaosExperiment {
  id: string;
  type: ChaosType;
  target: string;
  duration: number;       // Seconds
  parameters: Record<string, unknown>;
  startTime?: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

// Configuration
export interface MonitorConfig {
  pollInterval: number;      // Milliseconds
  services: ServiceEndpoint[];
  anomalyThresholds: AnomalyThresholds;
}

export interface ServiceEndpoint {
  name: string;
  healthUrl: string;
  metricsUrl: string;
}

export interface AnomalyThresholds {
  latencyZScore: number;       // Z-score threshold for latency
  errorRateThreshold: number;  // Percentage
  memoryThreshold: number;     // Percentage
  cpuThreshold: number;        // Percentage
  ewmaAlpha: number;           // EWMA smoothing factor (0-1)
}

// API Response Types
export interface HealthCheckResponse {
  status: HealthStatus;
  serviceName: string;
  timestamp: string;
  uptime: number;
  version?: string;
}

export interface MetricsResponse {
  serviceName: string;
  timestamp: string;
  metrics: {
    requestCount: number;
    errorCount: number;
    latencies: number[];
    memory: MemoryMetrics;
  };
}

// Event Types for Internal Communication
export interface SystemEvent {
  type: 'anomaly_detected' | 'healing_started' | 'healing_completed' | 'service_status_changed';
  timestamp: Date;
  data: unknown;
}
