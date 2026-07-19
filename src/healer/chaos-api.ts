// Rate-limited, allowlisted chaos injection for the hosted demo dashboard —
// no shell/docker access needed by callers.
import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import axios from 'axios';
import { HealingActions } from './actions';
import { SERVICES } from '../shared/config';
import { createLogger } from '../shared/logger';

const logger = createLogger('ChaosAPI');

export type ChaosScenario = 'kill-random' | 'latency-random' | 'memory-leak-random' | 'cascade';

const SCENARIOS: ChaosScenario[] = ['kill-random', 'latency-random', 'memory-leak-random', 'cascade'];

const GLOBAL_COOLDOWN_MS = 45_000;
let cooldownUntil = 0;

const serviceNames = Object.keys(SERVICES);

function randomService(): string {
  return serviceNames[Math.floor(Math.random() * serviceNames.length)];
}

function serviceUrl(serviceName: string): string {
  const service = SERVICES[serviceName as keyof typeof SERVICES];
  return `http://${service.host}:${service.port}`;
}

async function killRandom(healingActions: HealingActions): Promise<string> {
  const target = randomService();
  const result = await healingActions.killContainer(`aegis-${target}`);
  return result.message;
}

async function latencyRandom(): Promise<string> {
  const target = randomService();
  await axios.post(`${serviceUrl(target)}/chaos/latency`, { ms: 2500 });
  return `Injected 2500ms latency into ${target}`;
}

async function memoryLeakRandom(): Promise<string> {
  const target = randomService();
  await axios.post(`${serviceUrl(target)}/chaos/memory-leak`, { size: 5_000_000 });
  return `Triggered memory leak in ${target}`;
}

async function cascade(healingActions: HealingActions): Promise<string> {
  // Mirrors chaos/inject-failures.sh's "cascade" scenario. Fire the later
  // steps on a timer rather than blocking the HTTP response on them.
  await axios.post(`${serviceUrl('service-a')}/chaos/latency`, { ms: 2000 });

  setTimeout(async () => {
    try {
      await axios.post(`${serviceUrl('service-b')}/chaos/failure`, { enabled: true });
    } catch (error) {
      logger.error('Cascade step 2 failed', { error: error instanceof Error ? error.message : error });
    }
  }, 5000);

  setTimeout(async () => {
    try {
      await healingActions.killContainer('aegis-service-c');
    } catch (error) {
      logger.error('Cascade step 3 failed', { error: error instanceof Error ? error.message : error });
    }
  }, 10000);

  return 'Cascade failure started: service-a latency now, service-b failure in 5s, service-c kill in 10s';
}

export function createChaosRouter(healingActions: HealingActions): Router {
  const router = express.Router();

  router.use(
    rateLimit({
      windowMs: 60_000,
      limit: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many chaos requests from this IP, slow down.' },
    })
  );

  router.post('/trigger', async (req, res) => {
    const { scenario } = req.body as { scenario?: string };

    if (!scenario || !SCENARIOS.includes(scenario as ChaosScenario)) {
      res.status(400).json({ error: `scenario must be one of: ${SCENARIOS.join(', ')}` });
      return;
    }

    const now = Date.now();
    if (now < cooldownUntil) {
      res.status(429).json({
        error: 'Someone else just triggered a failure on this shared demo. Try again shortly.',
        retryAfterSeconds: Math.ceil((cooldownUntil - now) / 1000),
      });
      return;
    }

    cooldownUntil = now + GLOBAL_COOLDOWN_MS;

    try {
      let message: string;
      switch (scenario as ChaosScenario) {
        case 'kill-random':
          message = await killRandom(healingActions);
          break;
        case 'latency-random':
          message = await latencyRandom();
          break;
        case 'memory-leak-random':
          message = await memoryLeakRandom();
          break;
        case 'cascade':
          message = await cascade(healingActions);
          break;
      }

      logger.info(`Chaos scenario triggered: ${scenario}`, { message });
      res.json({ scenario, message, cooldownSeconds: GLOBAL_COOLDOWN_MS / 1000 });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Chaos scenario failed: ${scenario}`, { error: errorMessage });
      res.status(500).json({ error: errorMessage });
    }
  });

  router.get('/scenarios', (req, res) => {
    res.json({ scenarios: SCENARIOS });
  });

  return router;
}
