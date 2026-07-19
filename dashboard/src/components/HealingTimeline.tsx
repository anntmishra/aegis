import { Clock, CheckCircle, AlertTriangle, Zap, RotateCcw, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface HealerStatus {
  status: string;
  uptime: number;
  stats: {
    totalDecisions: number;
    successfulHealings: number;
    failedHealings: number;
    successRate: string;
  };
}

interface HealingLog {
  id: string;
  time: string;
  service: string;
  symptoms: string[];
  root_cause: string;
  action: string;
  confidence: number;
  details: { success: boolean };
}

interface HealingTimelineProps {
  logs: HealingLog[];
  healerStatus: HealerStatus | null;
}

function formatTime(timeStr: string): string {
  try {
    const date = new Date(timeStr);
    if (Number.isNaN(date.getTime())) return timeStr;
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return timeStr;
  }
}

function getActionIcon(action: string) {
  if (action.toLowerCase().includes('restart')) return <RotateCcw className="w-4 h-4" />;
  if (action.toLowerCase().includes('scale')) return <Zap className="w-4 h-4" />;
  return <ArrowRight className="w-4 h-4" />;
}

export function HealingTimeline({ logs, healerStatus }: HealingTimelineProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <CardTitle>Healing Timeline</CardTitle>
            <CardDescription>Recent auto-healing events</CardDescription>
          </div>
        </div>
        {healerStatus && (
          <div className="text-right">
            <p className="text-2xl font-semibold">{healerStatus.stats.totalDecisions}</p>
            <p className="text-xs text-muted-foreground">Total Actions</p>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {healerStatus && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-md border p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Successful</span>
              </div>
              <p className="text-xl font-semibold">{healerStatus.stats.successfulHealings}</p>
            </div>
            <div className={`rounded-md border p-3 ${healerStatus.stats.failedHealings > 0 ? 'border-destructive' : ''}`}>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className={`w-4 h-4 ${healerStatus.stats.failedHealings > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                <span className="text-xs text-muted-foreground">Failed</span>
              </div>
              <p className={`text-xl font-semibold ${healerStatus.stats.failedHealings > 0 ? 'text-destructive' : ''}`}>
                {healerStatus.stats.failedHealings}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Success Rate</span>
              </div>
              <p className="text-xl font-semibold">{healerStatus.stats.successRate}</p>
            </div>
          </div>
        )}

        <div className="space-y-0 max-h-[300px] overflow-y-auto pr-2">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCircle className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">No Healing Events Yet</p>
              <p className="text-xs">System is running smoothly</p>
            </div>
          ) : (
            logs.map((log, index) => {
              const failed = log.details?.success === false;
              return (
                <div key={log.id || index} className="relative pl-6 pb-4 border-l last:pb-0">
                  <div className={`absolute left-0 w-3 h-3 rounded-full -translate-x-1/2 border-2 border-background ${failed ? 'bg-destructive' : 'bg-foreground'}`} />
                  <div className={`rounded-md border p-4 ${failed ? 'border-destructive' : ''}`}>
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant={failed ? 'destructive' : 'outline'}>
                        {getActionIcon(log.action)}
                        <span>{log.action}</span>
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatTime(log.time)}</span>
                    </div>

                    <div className="mb-2">
                      <p className="text-sm font-medium">{log.service}</p>
                      <p className="text-xs text-muted-foreground">{log.root_cause}</p>
                    </div>

                    {log.symptoms.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {log.symptoms.map((symptom, idx) => (
                          <span key={idx} className="text-xs bg-muted border px-2 py-0.5 rounded text-muted-foreground">
                            {symptom}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${failed ? 'bg-destructive' : 'bg-foreground'}`}
                          style={{ width: `${log.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">
                        {(log.confidence * 100).toFixed(0)}%
                      </span>
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
