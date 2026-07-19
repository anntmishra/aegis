import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Target, Clock, Award, Gauge, Timer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { monoFill, DESTRUCTIVE_HEX, type Theme } from '@/lib/theme';
import { formatDuration } from '@/lib/utils';

interface EvalMetrics {
  mttd: number;
  mttr: number;
  successRate: number;
  totalIncidents: number;
  resolvedIncidents: number;
}

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

interface EvaluationMetricsProps {
  evalMetrics: EvalMetrics | null;
  healerStatus: HealerStatus | null;
  theme: Theme;
}

function formatTime(ms: number): string {
  if (ms === 0) return '< 1ms';
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function EvaluationMetrics({ evalMetrics, healerStatus, theme }: EvaluationMetricsProps) {
  const successRate = evalMetrics?.successRate ?? (healerStatus ? parseFloat(healerStatus.stats.successRate) : 100);
  const failRate = 100 - successRate;
  const successHex = monoFill(theme);
  const failHex = DESTRUCTIVE_HEX[theme];

  const pieData = [
    { name: 'Success', value: successRate, color: successHex },
    { name: 'Failed', value: failRate, color: failHex },
  ];

  const metrics = [
    { label: 'MTTD', sublabel: 'Mean Time to Detect', value: formatTime(evalMetrics?.mttd ?? 0), icon: <Clock className="w-5 h-5" /> },
    { label: 'MTTR', sublabel: 'Mean Time to Recover', value: formatTime(evalMetrics?.mttr ?? 0), icon: <Timer className="w-5 h-5" /> },
    {
      label: 'Incidents',
      sublabel: 'Resolved / Total',
      value: `${evalMetrics?.resolvedIncidents ?? healerStatus?.stats.successfulHealings ?? 0}/${evalMetrics?.totalIncidents ?? healerStatus?.stats.totalDecisions ?? 0}`,
      icon: <Target className="w-5 h-5" />,
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="p-2 rounded-lg bg-muted">
          <Gauge className="w-5 h-5" />
        </div>
        <div>
          <CardTitle>System Resilience</CardTitle>
          <CardDescription>Performance & reliability metrics</CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col items-center">
            <div className="relative">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-popover border rounded-lg p-2 shadow-md">
                            <p className="text-sm font-medium">{payload[0].name}: {Number(payload[0].value).toFixed(1)}%</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Award className="w-5 h-5 mb-1 text-muted-foreground" />
                <p className="text-3xl font-semibold">{successRate.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Success</p>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: successHex }} />
                <span className="text-xs text-muted-foreground">Success</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: failHex }} />
                <span className="text-xs text-muted-foreground">Failed</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {metrics.map((metric, index) => (
              <div key={index} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-muted-foreground">{metric.icon}</div>
                    <div>
                      <p className="text-xs text-muted-foreground">{metric.sublabel}</p>
                      <p className="text-sm font-medium">{metric.label}</p>
                    </div>
                  </div>
                  <p className="text-xl font-semibold">{metric.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator className="my-6" />

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Healer Uptime</p>
            <p className="text-lg font-semibold">{healerStatus ? formatDuration(healerStatus.uptime) : 'N/A'}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Auto-Healed</p>
            <p className="text-lg font-semibold">{healerStatus?.stats.totalDecisions ?? evalMetrics?.totalIncidents ?? 0}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
