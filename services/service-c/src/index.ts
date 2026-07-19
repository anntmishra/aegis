import express, { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 3000;
const SERVICE_NAME = process.env.SERVICE_NAME || 'service-c';

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

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  lastUpdated: string;
}

const inventory: Map<string, InventoryItem> = new Map([
  ['item-1', { id: 'item-1', name: 'Widget A', quantity: 100, price: 9.99, lastUpdated: new Date().toISOString() }],
  ['item-2', { id: 'item-2', name: 'Widget B', quantity: 50, price: 19.99, lastUpdated: new Date().toISOString() }],
  ['item-3', { id: 'item-3', name: 'Widget C', quantity: 200, price: 4.99, lastUpdated: new Date().toISOString() }],
]);

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

app.get('/inventory', async (req: Request, res: Response) => {
  if (simulatedLatency > 0) {
    await new Promise(resolve => setTimeout(resolve, simulatedLatency));
  }

  if (simulatedFailure) {
    res.status(500).json({ error: 'Service unavailable' });
    return;
  }

  res.json({
    items: Array.from(inventory.values()),
    count: inventory.size,
  });
});

app.get('/inventory/:id', async (req: Request, res: Response) => {
  if (simulatedLatency > 0) {
    await new Promise(resolve => setTimeout(resolve, simulatedLatency));
  }

  if (simulatedFailure) {
    res.status(500).json({ error: 'Service unavailable' });
    return;
  }

  const { id } = req.params;
  const item = inventory.get(id);
  
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  
  res.json(item);
});

app.post('/inventory', async (req: Request, res: Response) => {
  if (simulatedLatency > 0) {
    await new Promise(resolve => setTimeout(resolve, simulatedLatency));
  }

  if (simulatedFailure) {
    res.status(500).json({ error: 'Service unavailable' });
    return;
  }

  const { name, quantity, price } = req.body;
  const itemId = uuidv4();
  
  const item: InventoryItem = {
    id: itemId,
    name,
    quantity: quantity || 0,
    price: price || 0,
    lastUpdated: new Date().toISOString(),
  };
  
  inventory.set(itemId, item);
  res.status(201).json(item);
});

app.patch('/inventory/:id/quantity', async (req: Request, res: Response) => {
  if (simulatedLatency > 0) {
    await new Promise(resolve => setTimeout(resolve, simulatedLatency));
  }

  if (simulatedFailure) {
    res.status(500).json({ error: 'Service unavailable' });
    return;
  }

  const { id } = req.params;
  const { quantity, operation } = req.body;
  
  const item = inventory.get(id);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  
  if (operation === 'add') {
    item.quantity += quantity;
  } else if (operation === 'subtract') {
    item.quantity = Math.max(0, item.quantity - quantity);
  } else {
    item.quantity = quantity;
  }
  
  item.lastUpdated = new Date().toISOString();
  inventory.set(id, item);
  
  res.json(item);
});

app.get('/inventory/:id/availability', async (req: Request, res: Response) => {
  if (simulatedLatency > 0) {
    await new Promise(resolve => setTimeout(resolve, simulatedLatency));
  }

  if (simulatedFailure) {
    res.status(500).json({ error: 'Service unavailable' });
    return;
  }

  const { id } = req.params;
  const requestedQty = parseInt(req.query.quantity as string) || 1;
  
  const item = inventory.get(id);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  
  res.json({
    itemId: id,
    available: item.quantity >= requestedQty,
    currentQuantity: item.quantity,
    requestedQuantity: requestedQty,
  });
});

app.delete('/inventory/:id', async (req: Request, res: Response) => {
  if (simulatedLatency > 0) {
    await new Promise(resolve => setTimeout(resolve, simulatedLatency));
  }

  if (simulatedFailure) {
    res.status(500).json({ error: 'Service unavailable' });
    return;
  }

  const { id } = req.params;
  
  if (!inventory.has(id)) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  
  inventory.delete(id);
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
  console.log(`🚀 ${SERVICE_NAME} (Inventory Service) running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Metrics: http://localhost:${PORT}/metrics`);
});
