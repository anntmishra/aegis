// =====================================================
// Aegis - Anomaly Detector
// Detects anomalies using EWMA and Z-score thresholding
// =====================================================

import { v4 as uuidv4 } from 'uuid';
import {
  Anomaly,
  AnomalyType,
  AnomalySeverity,
  ServiceMetrics,
  BaselineStats,
  AnomalyThresholds,
} from '../shared/types';
import { DEFAULT_THRESHOLDS } from '../shared/config';
import { createLogger } from '../shared/logger';

const logger = createLogger('AnomalyDetector');

export class AnomalyDetector {
  private baselines: Map<string, Map<string, BaselineStats>> = new Map();
  private thresholds: AnomalyThresholds;
  private readonly minSamples = 10; // Minimum samples before detecting anomalies

  constructor(thresholds: AnomalyThresholds = DEFAULT_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  /**
   * Detect anomalies in service metrics
   */
  detectAnomalies(metrics: ServiceMetrics): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const serviceName = metrics.serviceName;

    // Initialize baselines for this service if needed
    if (!this.baselines.has(serviceName)) {
      this.baselines.set(serviceName, new Map());
    }

    // Check latency anomalies
    const latencyAnomaly = this.checkLatencyAnomaly(metrics);
    if (latencyAnomaly) anomalies.push(latencyAnomaly);

    // Check error rate anomalies
    const errorAnomaly = this.checkErrorRateAnomaly(metrics);
    if (errorAnomaly) anomalies.push(errorAnomaly);

    // Check memory anomalies
    const memoryAnomaly = this.checkMemoryAnomaly(metrics);
    if (memoryAnomaly) anomalies.push(memoryAnomaly);

    // Check CPU anomalies
    const cpuAnomaly = this.checkCpuAnomaly(metrics);
    if (cpuAnomaly) anomalies.push(cpuAnomaly);

    // Check if service is down
    const downAnomaly = this.checkServiceDown(metrics);
    if (downAnomaly) anomalies.push(downAnomaly);

    // Update baselines
    this.updateBaselines(metrics);

    if (anomalies.length > 0) {
      logger.warn(`Detected ${anomalies.length} anomalies in ${serviceName}`, {
        anomalies: anomalies.map(a => ({ type: a.type, severity: a.severity })),
      });
    }

    return anomalies;
  }

  /**
   * Check for latency anomalies using Z-score
   */
  private checkLatencyAnomaly(metrics: ServiceMetrics): Anomaly | null {
    const baseline = this.getBaseline(metrics.serviceName, 'latency');
    const currentLatency = metrics.latency.p95;

    if (!baseline || baseline.sampleCount < this.minSamples) {
      return null;
    }

    const zScore = this.calculateZScore(currentLatency, baseline.mean, baseline.stdDev);

    if (zScore > this.thresholds.latencyZScore) {
      const severity = this.determineSeverity(zScore, [2, 3, 4]);
      
      return {
        id: uuidv4(),
        serviceName: metrics.serviceName,
        type: 'latency_spike',
        severity,
        timestamp: new Date(),
        value: currentLatency,
        threshold: baseline.mean + (this.thresholds.latencyZScore * baseline.stdDev),
        baseline: baseline.mean,
        description: `Latency spike detected: ${currentLatency.toFixed(2)}ms (baseline: ${baseline.mean.toFixed(2)}ms, Z-score: ${zScore.toFixed(2)})`,
      };
    }

    return null;
  }

  /**
   * Check for error rate anomalies
   */
  private checkErrorRateAnomaly(metrics: ServiceMetrics): Anomaly | null {
    if (metrics.errorRate > this.thresholds.errorRateThreshold) {
      const severity = this.determineSeverity(metrics.errorRate, [5, 15, 30]);
      
      return {
        id: uuidv4(),
        serviceName: metrics.serviceName,
        type: 'error_burst',
        severity,
        timestamp: new Date(),
        value: metrics.errorRate,
        threshold: this.thresholds.errorRateThreshold,
        baseline: 0,
        description: `Error rate spike: ${metrics.errorRate.toFixed(2)}% (threshold: ${this.thresholds.errorRateThreshold}%)`,
      };
    }

    return null;
  }

  /**
   * Check for memory exhaustion
   */
  private checkMemoryAnomaly(metrics: ServiceMetrics): Anomaly | null {
    if (metrics.memory.percentage > this.thresholds.memoryThreshold) {
      const severity = this.determineSeverity(metrics.memory.percentage, [85, 92, 97]);
      
      return {
        id: uuidv4(),
        serviceName: metrics.serviceName,
        type: 'memory_exhaustion',
        severity,
        timestamp: new Date(),
        value: metrics.memory.percentage,
        threshold: this.thresholds.memoryThreshold,
        baseline: 50, // Assumed baseline
        description: `Memory usage critical: ${metrics.memory.percentage.toFixed(2)}% (threshold: ${this.thresholds.memoryThreshold}%)`,
      };
    }

    return null;
  }

  /**
   * Check for CPU overload
   */
  private checkCpuAnomaly(metrics: ServiceMetrics): Anomaly | null {
    if (metrics.cpu.percentage > this.thresholds.cpuThreshold) {
      const severity = this.determineSeverity(metrics.cpu.percentage, [80, 90, 95]);
      
      return {
        id: uuidv4(),
        serviceName: metrics.serviceName,
        type: 'cpu_overload',
        severity,
        timestamp: new Date(),
        value: metrics.cpu.percentage,
        threshold: this.thresholds.cpuThreshold,
        baseline: 30, // Assumed baseline
        description: `CPU usage critical: ${metrics.cpu.percentage.toFixed(2)}% (threshold: ${this.thresholds.cpuThreshold}%)`,
      };
    }

    return null;
  }

  /**
   * Check if service is down
   */
  private checkServiceDown(metrics: ServiceMetrics): Anomaly | null {
    // If error rate is 100% and uptime is 0, service is down
    if (metrics.errorRate === 100 && metrics.uptime === 0) {
      return {
        id: uuidv4(),
        serviceName: metrics.serviceName,
        type: 'service_down',
        severity: 'critical',
        timestamp: new Date(),
        value: 0,
        threshold: 1,
        baseline: 100,
        description: `Service ${metrics.serviceName} is DOWN - not responding to health checks`,
      };
    }

    return null;
  }

  /**
   * Calculate Z-score
   */
  private calculateZScore(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
  }

  /**
   * Determine severity based on value and thresholds
   */
  private determineSeverity(value: number, thresholds: [number, number, number]): AnomalySeverity {
    if (value >= thresholds[2]) return 'critical';
    if (value >= thresholds[1]) return 'high';
    if (value >= thresholds[0]) return 'medium';
    return 'low';
  }

  /**
   * Update baselines using EWMA
   */
  private updateBaselines(metrics: ServiceMetrics): void {
    const serviceName = metrics.serviceName;
    const alpha = this.thresholds.ewmaAlpha;

    // Update latency baseline
    this.updateMetricBaseline(serviceName, 'latency', metrics.latency.p95, alpha);

    // Update error rate baseline
    this.updateMetricBaseline(serviceName, 'errorRate', metrics.errorRate, alpha);

    // Update memory baseline
    this.updateMetricBaseline(serviceName, 'memory', metrics.memory.percentage, alpha);

    // Update CPU baseline
    this.updateMetricBaseline(serviceName, 'cpu', metrics.cpu.percentage, alpha);
  }

  /**
   * Update a single metric baseline using EWMA
   */
  private updateMetricBaseline(
    serviceName: string,
    metric: string,
    value: number,
    alpha: number
  ): void {
    const serviceBaselines = this.baselines.get(serviceName)!;
    let baseline = serviceBaselines.get(metric);

    if (!baseline) {
      // Initialize baseline
      baseline = {
        serviceName,
        metric,
        mean: value,
        stdDev: 0,
        ewma: value,
        sampleCount: 1,
        lastUpdated: new Date(),
      };
    } else {
      // Update EWMA
      baseline.ewma = alpha * value + (1 - alpha) * baseline.ewma;
      
      // Update mean and standard deviation (online algorithm)
      const n = baseline.sampleCount + 1;
      const delta = value - baseline.mean;
      baseline.mean += delta / n;
      
      // Welford's algorithm for variance
      const delta2 = value - baseline.mean;
      const m2 = baseline.stdDev * baseline.stdDev * (n - 1) + delta * delta2;
      baseline.stdDev = Math.sqrt(m2 / n);
      
      baseline.sampleCount = n;
      baseline.lastUpdated = new Date();
    }

    serviceBaselines.set(metric, baseline);
  }

  /**
   * Get baseline for a metric
   */
  private getBaseline(serviceName: string, metric: string): BaselineStats | null {
    const serviceBaselines = this.baselines.get(serviceName);
    if (!serviceBaselines) return null;
    return serviceBaselines.get(metric) || null;
  }

  /**
   * Get all baselines for a service
   */
  getServiceBaselines(serviceName: string): Map<string, BaselineStats> | null {
    return this.baselines.get(serviceName) || null;
  }

  /**
   * Reset baselines for a service
   */
  resetBaselines(serviceName: string): void {
    this.baselines.set(serviceName, new Map());
    logger.info(`Reset baselines for ${serviceName}`);
  }

  /**
   * Translate anomalies to human-readable symptoms
   */
  translateToSymptoms(anomalies: Anomaly[]): string[] {
    const symptomMap: Record<AnomalyType, string> = {
      latency_spike: 'latency spike',
      error_burst: 'error burst',
      memory_exhaustion: 'memory exhaustion',
      cpu_overload: 'CPU overload',
      service_down: 'service down',
      request_flood: 'request flood',
      slow_response: 'slow response',
    };

    return anomalies.map(a => symptomMap[a.type] || a.type);
  }
}

export default AnomalyDetector;
