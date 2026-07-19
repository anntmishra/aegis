import { Users, Package, Boxes, Server, Activity, HardDrive, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { healthVariant } from '@/lib/theme';
import { formatDuration } from '@/lib/utils';

interface ServiceStatus {
  metrics: {
    latency: { p50: number; p95: number; p99: number; avg: number };
    errorRate: number;
    memory: { used: number; limit: number; percentage: number };
    uptime: number;
  };
  anomalies: Array<{ type: string; severity: string; description: string }>;
  health: 'healthy' | 'degraded' | 'critical';
}

interface ServiceCardProps {
  name: string;
  service: ServiceStatus;
}

const SERVICE_DISPLAY_NAMES: Record<string, string> = {
  'service-a': 'User Service',
  'service-b': 'Order Service',
  'service-c': 'Inventory Service',
};

const SERVICE_ICONS: Record<string, typeof Users> = {
  'service-a': Users,
  'service-b': Package,
  'service-c': Boxes,
};

export function ServiceCard({ name, service }: ServiceCardProps) {
  const variant = healthVariant(service.health);
  const Icon = SERVICE_ICONS[name] || Server;
  const memoryPercent = service.metrics.memory.percentage;

  return (
    <Card className={service.health === 'critical' ? 'border-destructive' : undefined}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Icon className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h3 className="text-base font-semibold leading-none">{SERVICE_DISPLAY_NAMES[name] || name}</h3>
            <code className="text-xs text-muted-foreground">{name}</code>
          </div>
        </div>
        <Badge variant={variant}>
          {service.health === 'healthy' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          <span className="capitalize">{service.health}</span>
        </Badge>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-md border p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Latency P95</span>
            </div>
            <p className="text-xl font-semibold">
              {service.metrics.latency.p95.toFixed(0)}
              <span className="text-sm font-normal text-muted-foreground ml-1">ms</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">avg: {service.metrics.latency.avg.toFixed(1)}ms</p>
          </div>

          <div className="rounded-md border p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Error Rate</span>
            </div>
            <p className="text-xl font-semibold">
              {service.metrics.errorRate.toFixed(2)}
              <span className="text-sm font-normal text-muted-foreground ml-1">%</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {service.metrics.errorRate === 0 ? 'No errors' : 'Needs attention'}
            </p>
          </div>

          <div className="rounded-md border p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <HardDrive className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Memory</span>
            </div>
            <p className="text-xl font-semibold">
              {memoryPercent.toFixed(0)}
              <span className="text-sm font-normal text-muted-foreground ml-1">%</span>
            </p>
            <Progress value={Math.min(memoryPercent, 100)} className="mt-2 h-1.5" />
          </div>

          <div className="rounded-md border p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Uptime</span>
            </div>
            <p className="text-xl font-semibold">{formatDuration(service.metrics.uptime)}</p>
            <p className="text-xs text-muted-foreground mt-1">Since last restart</p>
          </div>
        </div>

        {service.anomalies.length > 0 && (
          <>
            <Separator className="mb-3" />
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium">
                {service.anomalies.length} Active Anomal{service.anomalies.length === 1 ? 'y' : 'ies'}
              </span>
            </div>
            <div className="space-y-1">
              {service.anomalies.slice(0, 2).map((anomaly, idx) => (
                <p key={idx} className="text-xs text-muted-foreground truncate">
                  {anomaly.description}
                </p>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
