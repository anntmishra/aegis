import express, { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 3000;
const SERVICE_NAME = process.env.SERVICE_NAME || 'service-a';

interface Metrics {
  requestCount: number;
  errorCount: number;
  latencies: number[];
  startTime: Date;
}

const metrics: Metrics = {
  requestCount: 0,
  errorCount: 0,
  latencies: [],
  startTime: new Date(),
};

let simulatedFailure = false;
let simulatedLatency = 0;
let memoryLeak: number[] = [];

app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  metrics.requestCount++;

  res.on('finish', () => {
    const latency = Date.now() - startTime;
    metrics.latencies.push(latency);

    if (metrics.latencies.length > 1000) {
      metrics.latencies.shift();
    }

    if (res.statusCode >= 400) {
      metrics.errorCount++;
    }
  });

  next();
});

app.use(express.json());

app.get('/health', async (req: Request, res: Response) => {
  if (simulatedFailure) {
    res.status(503).json({
      status: 'unhealthy',
      serviceName: SERVICE_NAME,
      timestamp: new Date().toISOString(),
      error: 'Simulated failure active',
    });
    return;
  }

  if (simulatedLatency > 0) {
    await new Promise(resolve => setTimeout(resolve, simulatedLatency));
  }

  const uptime = Math.floor((Date.now() - metrics.startTime.getTime()) / 1000);

  res.json({
    status: 'healthy',
    serviceName: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    uptime,
    version: '1.0.0',
  });
});

app.get('/metrics', (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();


  res.json({
    serviceName: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    metrics: {
      requestCount: metrics.requestCount,
      errorCount: metrics.errorCount,
      latencies: metrics.latencies.slice(-100), // Last 100 latencies
      memory: {
        used: memoryUsage.heapUsed,
        limit: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      },
    },
  });
});

app.get('/users', async (req: Request, res: Response) => {
  if (simulatedLatency > 0) {
    await new Promise(resolve => setTimeout(resolve, simulatedLatency));
  }

  if (simulatedFailure) {
    res.status(500).json({ error: 'Service unavailable' });
    return;
  }

  res.json({
    users: [
      { id: '1', name: 'Alice', email: 'alice@example.com' },
      { id: '2', name: 'Bob', email: 'bob@example.com' },
      { id: '3', name: 'Charlie', email: 'charlie@example.com' },
    ],
  });
});

app.get('/users/:id', async (req: Request, res: Response) => {
  if (simulatedLatency > 0) {
    await new Promise(resolve => setTimeout(resolve, simulatedLatency));
  }

  if (simulatedFailure) {
    res.status(500).json({ error: 'Service unavailable' });
    return;
  }

  const { id } = req.params;
  res.json({
    id,
    name: `User ${id}`,
    email: `user${id}@example.com`,
    createdAt: new Date().toISOString(),
  });
});

app.post('/users', async (req: Request, res: Response) => {
  if (simulatedLatency > 0) {
    await new Promise(resolve => setTimeout(resolve, simulatedLatency));
  }

  if (simulatedFailure) {
    res.status(500).json({ error: 'Service unavailable' });
    return;
  }

  const { name, email } = req.body;
  res.status(201).json({
    id: uuidv4(),
    name,
    email,
    createdAt: new Date().toISOString(),
  });
});

app.post('/chaos/failure', (req: Request, res: Response) => {
  const { enabled } = req.body;
  simulatedFailure = enabled === true;
  res.json({ simulatedFailure });
});

app.post('/chaos/latency', (req: Request, res: Response) => {
  const { ms } = req.body;
  simulatedLatency = typeof ms === 'number' ? ms : 0;
  res.json({ simulatedLatency });
});

app.post('/chaos/memory-leak', (req: Request, res: Response) => {
  const { size } = req.body;
  const leakSize = typeof size === 'number' ? size : 1000000;

  for (let i = 0; i < leakSize; i++) {
    memoryLeak.push(Math.random());
  }

  res.json({
    leakSize: memoryLeak.length,
    memoryUsage: process.memoryUsage(),
  });
});

app.post('/chaos/clear-memory', (req: Request, res: Response) => {
  memoryLeak = [];
  global.gc && global.gc();
  res.json({
    leakSize: memoryLeak.length,
    memoryUsage: process.memoryUsage(),
  });
});

app.post('/chaos/reset', (req: Request, res: Response) => {
  simulatedFailure = false;
  simulatedLatency = 0;
  memoryLeak = [];
  res.json({ message: 'All chaos settings reset' });
});

app.listen(PORT, () => {
  console.log(`🚀 ${SERVICE_NAME} running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Metrics: http://localhost:${PORT}/metrics`);
});
