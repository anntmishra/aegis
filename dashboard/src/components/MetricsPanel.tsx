import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { monoRamp, monoFill, type Theme } from '@/lib/theme';

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

interface MetricsPanelProps {
  services: Record<string, ServiceStatus>;
  theme: Theme;
}

function ChartTooltip({ active, payload, label, unit }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border rounded-lg p-3 shadow-md">
        <p className="text-sm font-medium mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium">{entry.value.toFixed(1)}{unit}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export function MetricsPanel({ services, theme }: MetricsPanelProps) {
  const [p50Fill, p95Fill, p99Fill] = monoRamp(theme);
  const solidFill = monoFill(theme);
  const gridColor = theme === 'dark' ? '#27272a' : '#e4e4e7';
  const tickColor = theme === 'dark' ? '#a1a1aa' : '#71717a';

  const latencyData = Object.entries(services).map(([name, service]) => ({
    name: name.replace('service-', 'Service ').toUpperCase(),
    P50: service.metrics.latency.p50,
    P95: service.metrics.latency.p95,
    P99: service.metrics.latency.p99,
  }));

  const memoryData = Object.entries(services).map(([name, service]) => ({
    name: name.replace('service-', 'Svc ').toUpperCase(),
    'Memory %': service.metrics.memory.percentage,
  }));

  const errorData = Object.entries(services).map(([name, service]) => ({
    name: name.replace('service-', 'Svc ').toUpperCase(),
    'Error Rate %': service.metrics.errorRate,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className="p-2 rounded-lg bg-muted">
          <BarChart3 className="w-5 h-5" />
        </div>
        <div>
          <CardTitle>Performance Metrics</CardTitle>
          <CardDescription>Real-time service performance</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {/* Latency Chart — single hue (grayscale ink), three percentiles */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Latency Percentiles</h4>
          <div className="bg-muted/40 rounded-lg p-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={latencyData} barCategoryGap="25%">
                <CartesianGrid vertical={false} stroke={gridColor} />
                <XAxis dataKey="name" stroke={tickColor} fontSize={11} tickLine={false} axisLine={{ stroke: gridColor }} />
                <YAxis stroke={tickColor} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}ms`} />
                <Tooltip content={(props) => <ChartTooltip {...props} unit="ms" />} cursor={{ fill: 'hsl(var(--muted))' }} />
                <Bar dataKey="P50" fill={p50Fill} name="P50" radius={[3, 3, 0, 0]} />
                <Bar dataKey="P95" fill={p95Fill} name="P95" radius={[3, 3, 0, 0]} />
                <Bar dataKey="P99" fill={p99Fill} name="P99" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-3">
            {(['P50', 'P95', 'P99'] as const).map((p, i) => (
              <div key={p} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: [p50Fill, p95Fill, p99Fill][i] }} />
                <span className="text-xs text-muted-foreground">{p}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Resource Usage — two honest small multiples, each on its own scale */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Resource Utilization</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/40 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-2">Memory</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={memoryData} barCategoryGap="30%">
                  <CartesianGrid vertical={false} stroke={gridColor} />
                  <XAxis dataKey="name" stroke={tickColor} fontSize={11} tickLine={false} axisLine={{ stroke: gridColor }} />
                  <YAxis domain={[0, 100]} stroke={tickColor} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={32} />
                  <Tooltip content={(props) => <ChartTooltip {...props} unit="%" />} cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Bar dataKey="Memory %" fill={solidFill} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-muted/40 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-2">Error Rate</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={errorData} barCategoryGap="30%">
                  <CartesianGrid vertical={false} stroke={gridColor} />
                  <XAxis dataKey="name" stroke={tickColor} fontSize={11} tickLine={false} axisLine={{ stroke: gridColor }} />
                  <YAxis stroke={tickColor} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={32} />
                  <Tooltip content={(props) => <ChartTooltip {...props} unit="%" />} cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Bar dataKey="Error Rate %" fill={solidFill} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
