import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../shared/logger';
import { EvaluationMetrics, Anomaly } from '../shared/types';

const logger = createLogger('Evaluator');

export interface Incident {
  id: string;
  serviceName: string;
  anomalies: Anomaly[];
  detectedAt: Date;
  healingStartedAt?: Date;
  resolvedAt?: Date;
  status: 'detected' | 'healing' | 'resolved' | 'failed';
  timeToDetect?: number;   // ms
  timeToRecover?: number;  // ms
}

export interface EvaluationSnapshot {
  timestamp: Date;
  windowStart: Date;
  windowEnd: Date;
  metrics: EvaluationMetrics;
  incidents: Incident[];
}

export class Evaluator {
  private incidents: Map<string, Incident> = new Map();
  private resolvedIncidents: Incident[] = [];
  private windowSize: number; // ms
  private readonly maxHistory = 1000;

  constructor(windowSize: number = 3600000) { // Default 1 hour
    this.windowSize = windowSize;
  }

  recordDetection(serviceName: string, anomalies: Anomaly[]): string {
    const incidentId = uuidv4();
    const now = new Date();

    for (const [id, incident] of this.incidents) {
      if (incident.serviceName === serviceName && incident.status !== 'resolved') {
        incident.anomalies = [...incident.anomalies, ...anomalies];
        logger.debug(`Updated existing incident ${id} for ${serviceName}`);
        return id;
      }
    }

    const incident: Incident = {
      id: incidentId,
      serviceName,
      anomalies,
      detectedAt: now,
      status: 'detected',
    };

    this.incidents.set(incidentId, incident);
    logger.info(`New incident detected: ${incidentId} for ${serviceName}`);

    return incidentId;
  }

  // Only transitions 'detected' incidents — a no-op if already healing, so
  // repeated polling won't keep resetting healingStartedAt.
  recordHealingStart(serviceName: string): void {
    const incident = this.findIncidentByService(serviceName);

    if (incident && incident.status === 'detected') {
      incident.healingStartedAt = new Date();
      incident.status = 'healing';
      incident.timeToDetect = incident.healingStartedAt.getTime() - incident.detectedAt.getTime();

      logger.info(`Healing started for incident ${incident.id}`, {
        serviceName: incident.serviceName,
        timeToDetect: incident.timeToDetect,
      });
    }
  }

  // Accept recovery from 'detected' too — a service can recover on its own
  // before the healer ever acts (still resolved, just contributes no MTTR
  // sample and counts toward falsePositives via the missing healingStartedAt).
  recordRecovery(serviceName: string, success: boolean): void {
    const incident = this.findIncidentByService(serviceName);

    if (incident && (incident.status === 'healing' || incident.status === 'detected')) {
      incident.resolvedAt = new Date();
      incident.status = success ? 'resolved' : 'failed';

      if (incident.healingStartedAt) {
        incident.timeToRecover = incident.resolvedAt.getTime() - incident.healingStartedAt.getTime();
      }

      this.incidents.delete(incident.id);
      this.resolvedIncidents.push(incident);

      if (this.resolvedIncidents.length > this.maxHistory) {
        this.resolvedIncidents.shift();
      }

      logger.info(`Incident ${incident.id} ${success ? 'resolved' : 'failed'}`, {
        serviceName,
        timeToRecover: incident.timeToRecover,
        totalTime: incident.resolvedAt.getTime() - incident.detectedAt.getTime(),
      });
    }
  }

  private findIncidentByService(serviceName: string): Incident | undefined {
    for (const incident of this.incidents.values()) {
      if (incident.serviceName === serviceName) {
        return incident;
      }
    }
    return undefined;
  }

  calculateMetrics(): EvaluationMetrics {
    const now = Date.now();
    const windowStart = now - this.windowSize;

    const windowIncidents = this.resolvedIncidents.filter(
      i => i.resolvedAt && i.resolvedAt.getTime() >= windowStart
    );

    const detectTimes = windowIncidents
      .filter(i => i.timeToDetect !== undefined)
      .map(i => i.timeToDetect!);

    const mttd = detectTimes.length > 0
      ? detectTimes.reduce((a, b) => a + b, 0) / detectTimes.length / 1000
      : 0;

    const recoverTimes = windowIncidents
      .filter(i => i.timeToRecover !== undefined)
      .map(i => i.timeToRecover!);

    const mttr = recoverTimes.length > 0
      ? recoverTimes.reduce((a, b) => a + b, 0) / recoverTimes.length / 1000
      : 0;

    const resolvedCount = windowIncidents.filter(i => i.status === 'resolved').length;
    const failedCount = windowIncidents.filter(i => i.status === 'failed').length;
    const totalIncidents = resolvedCount + failedCount;

    const successRate = totalIncidents > 0
      ? (resolvedCount / totalIncidents) * 100
      : 100;

    // Incidents that resolved without the healer ever acting
    const falsePositives = windowIncidents.filter(
      i => i.status === 'resolved' && !i.healingStartedAt
    ).length;

    return {
      mttd,
      mttr,
      successRate,
      totalIncidents,
      resolvedIncidents: resolvedCount,
      falsePositives,
    };
  }

  getSnapshot(): EvaluationSnapshot {
    const now = new Date();
    return {
      timestamp: now,
      windowStart: new Date(now.getTime() - this.windowSize),
      windowEnd: now,
      metrics: this.calculateMetrics(),
      incidents: [...this.resolvedIncidents.slice(-50)],
    };
  }

  getActiveIncidents(): Incident[] {
    return Array.from(this.incidents.values());
  }

  getIncidentHistory(limit: number = 100): Incident[] {
    return this.resolvedIncidents.slice(-limit);
  }

  getMetricsTimeline(bucketSize: number = 300000): Array<{
    timestamp: Date;
    mttd: number;
    mttr: number;
    successRate: number;
    incidentCount: number;
  }> {
    const now = Date.now();
    const buckets: Map<number, Incident[]> = new Map();

    for (const incident of this.resolvedIncidents) {
      if (!incident.resolvedAt) continue;

      const bucketTime = Math.floor(incident.resolvedAt.getTime() / bucketSize) * bucketSize;
      const bucket = buckets.get(bucketTime) || [];
      bucket.push(incident);
      buckets.set(bucketTime, bucket);
    }

    const timeline: Array<{
      timestamp: Date;
      mttd: number;
      mttr: number;
      successRate: number;
      incidentCount: number;
    }> = [];

    const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);

    for (const [bucketTime, incidents] of sortedBuckets) {
      const detectTimes = incidents
        .filter(i => i.timeToDetect !== undefined)
        .map(i => i.timeToDetect!);
      
      const recoverTimes = incidents
        .filter(i => i.timeToRecover !== undefined)
        .map(i => i.timeToRecover!);

      const resolved = incidents.filter(i => i.status === 'resolved').length;
      const total = incidents.length;

      timeline.push({
        timestamp: new Date(bucketTime),
        mttd: detectTimes.length > 0
          ? detectTimes.reduce((a, b) => a + b, 0) / detectTimes.length / 1000
          : 0,
        mttr: recoverTimes.length > 0
          ? recoverTimes.reduce((a, b) => a + b, 0) / recoverTimes.length / 1000
          : 0,
        successRate: total > 0 ? (resolved / total) * 100 : 100,
        incidentCount: total,
      });
    }

    return timeline;
  }

  getServiceMetrics(): Record<string, {
    totalIncidents: number;
    resolvedIncidents: number;
    avgMTTD: number;
    avgMTTR: number;
    successRate: number;
  }> {
    const serviceMetrics: Record<string, {
      incidents: Incident[];
    }> = {};

    for (const incident of this.resolvedIncidents) {
      if (!serviceMetrics[incident.serviceName]) {
        serviceMetrics[incident.serviceName] = { incidents: [] };
      }
      serviceMetrics[incident.serviceName].incidents.push(incident);
    }

    const result: Record<string, any> = {};

    for (const [serviceName, data] of Object.entries(serviceMetrics)) {
      const incidents = data.incidents;
      const resolved = incidents.filter(i => i.status === 'resolved').length;
      
      const detectTimes = incidents
        .filter(i => i.timeToDetect !== undefined)
        .map(i => i.timeToDetect!);
      
      const recoverTimes = incidents
        .filter(i => i.timeToRecover !== undefined)
        .map(i => i.timeToRecover!);

      result[serviceName] = {
        totalIncidents: incidents.length,
        resolvedIncidents: resolved,
        avgMTTD: detectTimes.length > 0
          ? detectTimes.reduce((a, b) => a + b, 0) / detectTimes.length / 1000
          : 0,
        avgMTTR: recoverTimes.length > 0
          ? recoverTimes.reduce((a, b) => a + b, 0) / recoverTimes.length / 1000
          : 0,
        successRate: incidents.length > 0 ? (resolved / incidents.length) * 100 : 100,
      };
    }

    return result;
  }
}

export default Evaluator;
