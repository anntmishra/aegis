import express, { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 3000;
const SERVICE_NAME = process.env.SERVICE_NAME || 'service-b';

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

const orders: Map<string, any> = new Map();

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
      latencies: metrics.latencies.slice(-100),
      memory: {
        used: memoryUsage.heapUsed,
        limit: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      },
    },
  });
});

app.get('/orders', async (req: Request, res: Response) => {
  if (simulatedLatency > 0) {
    await new Promise(resolve => setTimeout(resolve, simulatedLatency));
  }

  if (simulatedFailure) {
    res.status(500).json({ error: 'Service unavailable' });
    return;
  }

  res.json({
    orders: Array.from(orders.values()),
    count: orders.size,
  });
});

app.get('/orders/:id', async (req: Request, res: Response) => {
  if (simulatedLatency > 0) {
    await new Promise(resolve => setTimeout(resolve, simulatedLatency));
  }

  if (simulatedFailure) {
    res.status(500).json({ error: 'Service unavailable' });
    return;
  }

  const { id } = req.params;
  const order = orders.get(id);
  
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  
  res.json(order);
});

app.post('/orders', async (req: Request, res: Response) => {
  if (simulatedLatency > 0) {
    await new Promise(resolve => setTimeout(resolve, simulatedLatency));
  }

  if (simulatedFailure) {
    res.status(500).json({ error: 'Service unavailable' });
    return;
  }

  const { userId, items, total } = req.body;
  const orderId = uuidv4();
  
  const order = {
    id: orderId,
    userId,
    items: items || [],
    total: total || 0,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  
  orders.set(orderId, order);
  res.status(201).json(order);
});

app.patch('/orders/:id/status', async (req: Request, res: Response) => {
  if (simulatedLatency > 0) {
    await new Promise(resolve => setTimeout(resolve, simulatedLatency));
  }

  if (simulatedFailure) {
    res.status(500).json({ error: 'Service unavailable' });
    return;
  }

  const { id } = req.params;
  const { status } = req.body;
  
  const order = orders.get(id);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  
  order.status = status;
  order.updatedAt = new Date().toISOString();
  orders.set(id, order);
  
  res.json(order);
});

app.delete('/orders/:id', async (req: Request, res: Response) => {
  if (simulatedLatency > 0) {
    await new Promise(resolve => setTimeout(resolve, simulatedLatency));
  }

  if (simulatedFailure) {
    res.status(500).json({ error: 'Service unavailable' });
    return;
  }

  const { id } = req.params;
  
  if (!orders.has(id)) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  
  orders.delete(id);
  res.status(204).send();
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
  console.log(`🚀 ${SERVICE_NAME} (Order Service) running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Metrics: http://localhost:${PORT}/metrics`);
});
