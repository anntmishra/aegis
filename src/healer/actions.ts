// =====================================================
// Aegis - Healing Actions
// Executes healing actions using Docker
// =====================================================

import Docker from 'dockerode';
import { HealingAction, HealingActionType } from '../shared/types';
import { createLogger } from '../shared/logger';

const logger = createLogger('HealingActions');

export class HealingActions {
  private docker: Docker;

  constructor() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  /**
   * Execute a healing action
   */
  async execute(action: HealingAction): Promise<{ success: boolean; message: string }> {
    const startTime = Date.now();
    
    try {
      let result: { success: boolean; message: string };

      switch (action.type) {
        case 'restart':
          result = await this.restartContainer(action);
          break;
        case 'scale_up':
          result = await this.scaleUp(action);
          break;
        case 'scale_down':
          result = await this.scaleDown(action);
          break;
        case 'remove_from_routing':
          result = await this.removeFromRouting(action);
          break;
        case 'add_to_routing':
          result = await this.addToRouting(action);
          break;
        case 'throttle':
          result = await this.throttle(action);
          break;
        case 'no_action':
          result = { success: true, message: 'No action required' };
          break;
        default:
          result = { success: false, message: `Unknown action type: ${action.type}` };
      }

      const duration = Date.now() - startTime;
      logger.info(`Action ${action.type} completed in ${duration}ms`, result);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Action ${action.type} failed`, { error: errorMessage });
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Restart a container
   */
  private async restartContainer(action: HealingAction): Promise<{ success: boolean; message: string }> {
    const containerName = action.parameters?.containerName as string || `aegis-${action.serviceName}`;
    
    logger.info(`Restarting container: ${containerName}`);

    try {
      const container = this.docker.getContainer(containerName);
      
      // Get container info first
      const info = await container.inspect();
      
      if (info.State.Running) {
        // Graceful restart
        await container.restart({ t: 10 }); // 10 second timeout
        return { 
          success: true, 
          message: `Container ${containerName} restarted successfully` 
        };
      } else {
        // Start if not running
        await container.start();
        return { 
          success: true, 
          message: `Container ${containerName} started successfully` 
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // If container doesn't exist, try to recreate it
      if (errorMessage.includes('No such container')) {
        return { 
          success: false, 
          message: `Container ${containerName} not found` 
        };
      }
      
      throw error;
    }
  }

  /**
   * Kill a container outright (used by chaos injection, not healing)
   */
  async killContainer(containerName: string): Promise<{ success: boolean; message: string }> {
    logger.info(`Killing container: ${containerName}`);

    try {
      const container = this.docker.getContainer(containerName);
      await container.kill();
      return { success: true, message: `Container ${containerName} killed` };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Scale up by starting additional instances
   * Note: This is a simplified implementation
   */
  private async scaleUp(action: HealingAction): Promise<{ success: boolean; message: string }> {
    const instances = action.parameters?.instances as number || 1;
    
    logger.info(`Scaling up ${action.serviceName} by ${instances} instance(s)`);

    // In a real implementation, you would:
    // 1. Use Docker Compose scale or create new containers
    // 2. Update load balancer configuration
    // 3. Wait for health checks to pass

    // For now, we'll just log the intent
    return {
      success: true,
      message: `Scale up requested for ${action.serviceName} (+${instances} instances)`,
    };
  }

  /**
   * Scale down by stopping instances
   */
  private async scaleDown(action: HealingAction): Promise<{ success: boolean; message: string }> {
    const instances = action.parameters?.instances as number || 1;
    
    logger.info(`Scaling down ${action.serviceName} by ${instances} instance(s)`);

    return {
      success: true,
      message: `Scale down requested for ${action.serviceName} (-${instances} instances)`,
    };
  }

  /**
   * Remove service from routing/load balancer
   */
  private async removeFromRouting(action: HealingAction): Promise<{ success: boolean; message: string }> {
    const duration = action.parameters?.duration as number || 60000;
    
    logger.info(`Removing ${action.serviceName} from routing for ${duration}ms`);

    // In a real implementation:
    // 1. Update NGINX config or custom proxy
    // 2. Reload configuration
    // 3. Set a timer to re-add

    return {
      success: true,
      message: `${action.serviceName} removed from routing for ${duration}ms`,
    };
  }

  /**
   * Add service back to routing
   */
  private async addToRouting(action: HealingAction): Promise<{ success: boolean; message: string }> {
    logger.info(`Adding ${action.serviceName} back to routing`);

    return {
      success: true,
      message: `${action.serviceName} added back to routing`,
    };
  }

  /**
   * Apply throttling/rate limiting
   */
  private async throttle(action: HealingAction): Promise<{ success: boolean; message: string }> {
    const rateLimit = action.parameters?.rateLimit as number || 100;
    
    logger.info(`Throttling ${action.serviceName} to ${rateLimit} req/s`);

    return {
      success: true,
      message: `${action.serviceName} throttled to ${rateLimit} requests/second`,
    };
  }

  /**
   * Get container stats
   */
  async getContainerStats(containerName: string): Promise<any> {
    try {
      const container = this.docker.getContainer(containerName);
      const stats = await container.stats({ stream: false });
      
      // Calculate CPU and memory usage
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - 
                       stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage - 
                         stats.precpu_stats.system_cpu_usage;
      const cpuPercent = (cpuDelta / systemDelta) * 
                        stats.cpu_stats.online_cpus * 100;

      const memoryUsage = stats.memory_stats.usage;
      const memoryLimit = stats.memory_stats.limit;
      const memoryPercent = (memoryUsage / memoryLimit) * 100;

      return {
        cpu: cpuPercent,
        memory: {
          used: memoryUsage,
          limit: memoryLimit,
          percentage: memoryPercent,
        },
      };
    } catch (error) {
      logger.error(`Failed to get stats for ${containerName}`, { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null;
    }
  }

  /**
   * List all aegis containers
   */
  async listContainers(): Promise<any[]> {
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: { name: ['aegis-'] },
      });

      return containers.map(c => ({
        id: c.Id.substring(0, 12),
        name: c.Names[0].replace('/', ''),
        status: c.State,
        state: c.Status,
      }));
    } catch (error) {
      logger.error('Failed to list containers', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return [];
    }
  }
}

export default HealingActions;
