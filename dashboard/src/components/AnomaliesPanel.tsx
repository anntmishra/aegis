import { AlertTriangle, AlertOctagon, AlertCircle, CheckCircle, Gauge, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { severityVariant } from '@/lib/theme';

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

interface AnomaliesPanelProps {
  services: Record<string, ServiceStatus>;
}

function severityIcon(severity: string) {
  switch (severity.toLowerCase()) {
    case 'critical': return <AlertOctagon className="w-4 h-4" />;
    case 'high': return <AlertTriangle className="w-4 h-4" />;
    case 'medium': return <AlertTriangle className="w-4 h-4" />;
    default: return <AlertCircle className="w-4 h-4" />;
  }
}

function getTypeIcon(type: string) {
  if (type.includes('latency')) return <Zap className="w-3 h-3" />;
  if (type.includes('memory') || type.includes('cpu')) return <Gauge className="w-3 h-3" />;
  return <AlertTriangle className="w-3 h-3" />;
}

export function AnomaliesPanel({ services }: AnomaliesPanelProps) {
  const allAnomalies = Object.entries(services).flatMap(([serviceName, service]) =>
    service.anomalies.map(anomaly => ({ ...anomaly, serviceName }))
  );

  const criticalCount = allAnomalies.filter(a => a.severity.toLowerCase() === 'critical').length;
  const highCount = allAnomalies.filter(a => a.severity.toLowerCase() === 'high').length;
  const otherCount = allAnomalies.length - criticalCount - highCount;

  return (
    <Card className={criticalCount > 0 ? 'border-destructive' : undefined}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            {allAnomalies.length > 0 ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
          </div>
          <div>
            <CardTitle>Active Anomalies</CardTitle>
            <CardDescription>Real-time anomaly detection</CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <Badge variant="destructive">
              <AlertOctagon className="w-3 h-3" />
              {criticalCount}
            </Badge>
          )}
          {highCount > 0 && (
            <Badge variant="secondary">
              <AlertTriangle className="w-3 h-3" />
              {highCount}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className={`rounded-md border p-3 text-center ${criticalCount > 0 ? 'border-destructive' : ''}`}>
            <p className={`text-2xl font-semibold ${criticalCount > 0 ? 'text-destructive' : ''}`}>{criticalCount}</p>
            <p className="text-xs text-muted-foreground">Critical</p>
          </div>
          <div className="rounded-md border p-3 text-center">
            <p className="text-2xl font-semibold">{highCount}</p>
            <p className="text-xs text-muted-foreground">High</p>
          </div>
          <div className="rounded-md border p-3 text-center">
            <p className="text-2xl font-semibold">{otherCount}</p>
            <p className="text-xs text-muted-foreground">Low / Medium</p>
          </div>
        </div>

        <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2">
          {allAnomalies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mb-3 opacity-40" />
              <p className="text-base font-medium">All Clear</p>
              <p className="text-sm">No anomalies detected</p>
            </div>
          ) : (
            allAnomalies.map((anomaly, index) => {
              const variant = severityVariant(anomaly.severity);
              const isLow = anomaly.severity.toLowerCase() === 'low';
              return (
                <div key={index} className={`rounded-md border p-4 ${variant === 'destructive' ? 'border-destructive' : ''} ${isLow ? 'opacity-70' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant={variant}>
                      {severityIcon(anomaly.severity)}
                      <span className="capitalize">{anomaly.severity}</span>
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">{anomaly.serviceName}</span>
                  </div>

                  <div className="flex items-start gap-2">
                    <div className="text-muted-foreground">{getTypeIcon(anomaly.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{anomaly.type}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{anomaly.description}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
