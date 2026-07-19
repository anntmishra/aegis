import { v4 as uuidv4 } from 'uuid';
import {
  Anomaly,
  AnomalyType,
  HealingDecision,
  HealingAction,
  HealingActionType,
  RootCause,
} from '../shared/types';
import { HEALER_CONFIG } from '../shared/config';
import { createLogger } from '../shared/logger';

const logger = createLogger('DecisionEngine');

interface HealingRule {
  name: string;
  conditions: {
    anomalyTypes: AnomalyType[];
    minSeverity?: string;
    minCount?: number;
  };
  action: HealingActionType;
  rootCause: string;
  confidence: number;
  priority: number;
}

export class DecisionEngine {
  private rules: HealingRule[];
  private recentDecisions: Map<string, HealingDecision[]> = new Map();
  private restartCooldowns: Map<string, Date> = new Map();

  constructor() {
    this.rules = this.initializeRules();
  }

  private initializeRules(): HealingRule[] {
    return [
      // Critical: service is completely down
      {
        name: 'service_down_restart',
        conditions: {
          anomalyTypes: ['service_down'],
        },
        action: 'restart',
        rootCause: 'service crash or unresponsive',
        confidence: 0.95,
        priority: 1,
      },

      // High: memory exhaustion
      {
        name: 'memory_exhaustion_restart',
        conditions: {
          anomalyTypes: ['memory_exhaustion'],
          minSeverity: 'high',
        },
        action: 'restart',
        rootCause: 'memory exhaustion',
        confidence: 0.85,
        priority: 2,
      },

      // High: combined latency and errors
      {
        name: 'degraded_performance_restart',
        conditions: {
          anomalyTypes: ['latency_spike', 'error_burst'],
          minCount: 2,
        },
        action: 'restart',
        rootCause: 'service degradation',
        confidence: 0.80,
        priority: 3,
      },

      // Medium: high error rate alone
      {
        name: 'error_burst_routing',
        conditions: {
          anomalyTypes: ['error_burst'],
          minSeverity: 'high',
        },
        action: 'remove_from_routing',
        rootCause: 'high error rate',
        confidence: 0.75,
        priority: 4,
      },

      // Medium: CPU overload, scale up
      {
        name: 'cpu_overload_scale',
        conditions: {
          anomalyTypes: ['cpu_overload'],
          minSeverity: 'high',
        },
        action: 'scale_up',
        rootCause: 'CPU overload',
        confidence: 0.70,
        priority: 5,
      },

      // Low: latency spike alone
      {
        name: 'latency_spike_throttle',
        conditions: {
          anomalyTypes: ['latency_spike'],
          minSeverity: 'medium',
        },
        action: 'throttle',
        rootCause: 'temporary latency increase',
        confidence: 0.60,
        priority: 6,
      },
    ];
  }

  makeDecision(serviceName: string, anomalies: Anomaly[]): HealingDecision | null {
    if (anomalies.length === 0) {
      return null;
    }

    logger.info(`Analyzing ${anomalies.length} anomalies for ${serviceName}`);

    if (this.isOnCooldown(serviceName)) {
      logger.info(`Service ${serviceName} is on cooldown, skipping healing`);
      return null;
    }

    const matchedRule = this.findMatchingRule(anomalies);

    if (!matchedRule) {
      logger.debug(`No matching rule for anomalies in ${serviceName}`);
      return null;
    }

    if (matchedRule.confidence < HEALER_CONFIG.confidenceThreshold) {
      logger.debug(`Rule confidence ${matchedRule.confidence} below threshold`);
      return null;
    }

    const decision = this.buildDecision(serviceName, anomalies, matchedRule);

    this.storeDecision(serviceName, decision);

    logger.info(`Decision made for ${serviceName}: ${decision.action.type}`, {
      rootCause: decision.rootCause.primary,
      confidence: decision.confidence,
    });

    return decision;
  }

  private findMatchingRule(anomalies: Anomaly[]): HealingRule | null {
    const anomalyTypes = anomalies.map(a => a.type);
    const maxSeverity = this.getMaxSeverity(anomalies);

    const sortedRules = [...this.rules].sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      const hasRequiredTypes = rule.conditions.anomalyTypes.every(
        type => anomalyTypes.includes(type)
      );

      if (!hasRequiredTypes) continue;

      if (rule.conditions.minSeverity) {
        if (!this.meetsMinSeverity(maxSeverity, rule.conditions.minSeverity)) {
          continue;
        }
      }

      if (rule.conditions.minCount) {
        const matchingCount = anomalies.filter(
          a => rule.conditions.anomalyTypes.includes(a.type)
        ).length;
        if (matchingCount < rule.conditions.minCount) {
          continue;
        }
      }

      return rule;
    }

    return null;
  }

  private buildDecision(
    serviceName: string,
    anomalies: Anomaly[],
    rule: HealingRule
  ): HealingDecision {
    const rootCause = this.analyzeRootCause(anomalies, rule);
    const action = this.buildAction(serviceName, rule);

    return {
      id: uuidv4(),
      timestamp: new Date(),
      serviceName,
      symptoms: anomalies,
      rootCause,
      action,
      confidence: rule.confidence,
      reasoning: this.buildReasoning(anomalies, rule, rootCause),
    };
  }

  private analyzeRootCause(anomalies: Anomaly[], rule: HealingRule): RootCause {
    const contributing: string[] = [];

    for (const anomaly of anomalies) {
      switch (anomaly.type) {
        case 'latency_spike':
          contributing.push('elevated response times');
          break;
        case 'error_burst':
          contributing.push('increased error rate');
          break;
        case 'memory_exhaustion':
          contributing.push('high memory usage');
          break;
        case 'cpu_overload':
          contributing.push('CPU saturation');
          break;
        case 'service_down':
          contributing.push('service unavailable');
          break;
      }
    }

    return {
      primary: rule.rootCause,
      contributing: [...new Set(contributing)],
      confidence: rule.confidence,
    };
  }

  private buildAction(serviceName: string, rule: HealingRule): HealingAction {
    return {
      type: rule.action,
      serviceName,
      parameters: this.getActionParameters(rule.action, serviceName),
    };
  }

  private getActionParameters(
    actionType: HealingActionType,
    serviceName: string
  ): Record<string, unknown> {
    switch (actionType) {
      case 'restart':
        return { containerName: `aegis-${serviceName}` };
      case 'scale_up':
        return { instances: 1 };
      case 'scale_down':
        return { instances: 1 };
      case 'remove_from_routing':
        return { duration: 60000 };
      case 'throttle':
        return { rateLimit: 100 };
      default:
        return {};
    }
  }

  private buildReasoning(
    anomalies: Anomaly[],
    rule: HealingRule,
    rootCause: RootCause
  ): string {
    const symptoms = anomalies
      .map(a => a.description)
      .join('; ');

    return `Detected: ${symptoms}. ` +
      `Root cause identified as ${rootCause.primary} ` +
      `with ${(rule.confidence * 100).toFixed(0)}% confidence. ` +
      `Taking action: ${rule.action}.`;
  }

  private getMaxSeverity(anomalies: Anomaly[]): string {
    const severityOrder = ['low', 'medium', 'high', 'critical'];
    let maxIndex = 0;

    for (const anomaly of anomalies) {
      const index = severityOrder.indexOf(anomaly.severity);
      if (index > maxIndex) maxIndex = index;
    }

    return severityOrder[maxIndex];
  }

  private meetsMinSeverity(actual: string, minimum: string): boolean {
    const severityOrder = ['low', 'medium', 'high', 'critical'];
    return severityOrder.indexOf(actual) >= severityOrder.indexOf(minimum);
  }

  private isOnCooldown(serviceName: string): boolean {
    const lastRestart = this.restartCooldowns.get(serviceName);
    if (!lastRestart) return false;

    const elapsed = Date.now() - lastRestart.getTime();
    return elapsed < HEALER_CONFIG.restartCooldown;
  }

  setCooldown(serviceName: string): void {
    this.restartCooldowns.set(serviceName, new Date());
  }

  private storeDecision(serviceName: string, decision: HealingDecision): void {
    const history = this.recentDecisions.get(serviceName) || [];
    history.push(decision);

    if (history.length > 100) {
      history.shift();
    }

    this.recentDecisions.set(serviceName, history);
  }

  getDecisionHistory(serviceName: string): HealingDecision[] {
    return this.recentDecisions.get(serviceName) || [];
  }
}

export default DecisionEngine;
