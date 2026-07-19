import axios from 'axios';
import { 
  ServiceMetrics, 
  HealthCheckResponse, 
  MetricsResponse,
  LatencyMetrics,
  HealthStatus 
} from '../shared/types';
import { SERVICES, MONITOR_CONFIG } from '../shared/config';
import { createLogger } from '../shared/logger';

const logger = createLogger('MetricsCollector');

export class MetricsCollector {
  private metricsHistory: Map<string, ServiceMetrics[]> = new Map();
  private readonly maxHistorySize = 1000;

  constructor() {
    Object.keys(SERVICES).forEach(serviceName => {
      this.metricsHistory.set(serviceName, []);
    });
  }

  async collectServiceMetrics(serviceName: string): Promise<ServiceMetrics | null> {
    const service = SERVICES[serviceName as keyof typeof SERVICES];
    if (!service) {
      logger.error(`Unknown service: ${serviceName}`);
      return null;
    }

    const baseUrl = `http://${service.host}:${service.port}`;
    
    try {
      const healthStart = Date.now();
      const healthResponse = await axios.get<HealthCheckResponse>(
        `${baseUrl}${service.healthUrl}`,
        { timeout: 5000 }
      );
      const healthLatency = Date.now() - healthStart;

      const metricsResponse = await axios.get<MetricsResponse>(
        `${baseUrl}${service.metricsUrl}`,
        { timeout: 5000 }
      );

      const metricsData = metricsResponse.data.metrics;

      const latencyMetrics = this.calculateLatencyStats(metricsData.latencies || []);

      const errorRate = metricsData.requestCount > 0
        ? (metricsData.errorCount / metricsData.requestCount) * 100
        : 0;

      const metrics: ServiceMetrics = {
        serviceName,
        timestamp: new Date(),
        latency: latencyMetrics,
        errorRate,
        requestRate: this.calculateRequestRate(serviceName, metricsData.requestCount),
        uptime: healthResponse.data.uptime || 0,
        memory: {
          used: metricsData.memory?.used || 0,
          limit: metricsData.memory?.limit || 0,
          percentage: metricsData.memory?.percentage || 0,
        },
        cpu: {
          percentage: 0, // populated from Docker stats
        },
      };

      this.storeMetrics(serviceName, metrics);

      logger.debug(`Collected metrics for ${serviceName}`, { 
        latency: latencyMetrics.avg, 
        errorRate, 
        memory: metrics.memory.percentage 
      });

      return metrics;

    } catch (error) {
      logger.warn(`Failed to collect metrics from ${serviceName}`, { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });

      const degradedMetrics: ServiceMetrics = {
        serviceName,
        timestamp: new Date(),
        latency: { p50: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0 },
        errorRate: 100,
        requestRate: 0,
        uptime: 0,
        memory: { used: 0, limit: 0, percentage: 0 },
        cpu: { percentage: 0 },
      };

      this.storeMetrics(serviceName, degradedMetrics);
      return degradedMetrics;
    }
  }

  async collectAllMetrics(): Promise<Map<string, ServiceMetrics>> {
    const results = new Map<string, ServiceMetrics>();


    const promises = Object.keys(SERVICES).map(async (serviceName) => {
      const metrics = await this.collectServiceMetrics(serviceName);
      if (metrics) {
        results.set(serviceName, metrics);
      }
    });

    await Promise.all(promises);
    return results;
  }

  private calculateLatencyStats(latencies: number[]): LatencyMetrics {
    if (latencies.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0 };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
      avg: sum / sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private calculateRequestRate(serviceName: string, currentCount: number): number {
    const history = this.metricsHistory.get(serviceName) || [];
    if (history.length < 2) return 0;

    const previousMetrics = history[history.length - 1];
    const timeDiff = (Date.now() - previousMetrics.timestamp.getTime()) / 1000;
    
    if (timeDiff <= 0) return 0;

    return Math.max(0, currentCount / Math.max(previousMetrics.uptime, 1));
  }

  private storeMetrics(serviceName: string, metrics: ServiceMetrics): void {
    const history = this.metricsHistory.get(serviceName) || [];
    history.push(metrics);

    if (history.length > this.maxHistorySize) {
      history.shift();
    }

    this.metricsHistory.set(serviceName, history);
  }

  getMetricsHistory(serviceName: string, count?: number): ServiceMetrics[] {
    const history = this.metricsHistory.get(serviceName) || [];
    return count ? history.slice(-count) : history;
  }

  getLatestMetrics(serviceName: string): ServiceMetrics | null {
    const history = this.metricsHistory.get(serviceName) || [];
    return history.length > 0 ? history[history.length - 1] : null;
  }

  async checkHealth(serviceName: string): Promise<HealthStatus> {
    const service = SERVICES[serviceName as keyof typeof SERVICES];
    if (!service) return 'unknown';

    try {
      const response = await axios.get<HealthCheckResponse>(
        `http://${service.host}:${service.port}${service.healthUrl}`,
        { timeout: 5000 }
      );
      return response.data.status as HealthStatus;
    } catch {
      return 'unhealthy';
    }
  }
}

export default MetricsCollector;
