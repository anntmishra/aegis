import { useState, useEffect } from 'react';
import { Shield, Activity, AlertTriangle, Clock, RefreshCw, Zap, Server, Heart, Sun, Moon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ServiceCard } from './components/ServiceCard';
import { MetricsPanel } from './components/MetricsPanel';
import { HealingTimeline } from './components/HealingTimeline';
import { AnomaliesPanel } from './components/AnomaliesPanel';
import { EvaluationMetrics } from './components/EvaluationMetrics';
import { useTheme } from './lib/theme';

// In production these default to same-origin paths that Caddy proxies to the
// right backend (see /Caddyfile). In local dev, vite.config.ts's own dev
// server proxy rewrites the same /api/* paths to localhost:400x, so no env
// override is needed in either case.
const MONITOR_BASE = import.meta.env.VITE_MONITOR_URL ?? '/api/monitor';
const HEALER_BASE = import.meta.env.VITE_HEALER_URL ?? '/api/healer';
const EVALUATOR_BASE = import.meta.env.VITE_EVALUATOR_URL ?? '/api/evaluator';

const CHAOS_SCENARIOS = [
  { key: 'kill-random', label: 'Kill a Service' },
  { key: 'latency-random', label: 'Inject Latency' },
  { key: 'memory-leak-random', label: 'Memory Leak' },
  { key: 'cascade', label: 'Cascade Failure' },
] as const;

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

interface SystemStatus {
  timestamp: string;
  services: Record<string, ServiceStatus>;
  totalAnomalies: number;
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

interface EvalMetrics {
  mttd: number;
  mttr: number;
  successRate: number;
  totalIncidents: number;
  resolvedIncidents: number;
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

function App() {
  const { theme, toggleTheme } = useTheme();
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [healerStatus, setHealerStatus] = useState<HealerStatus | null>(null);
  const [evalMetrics, setEvalMetrics] = useState<EvalMetrics | null>(null);
  const [healingLogs, setHealingLogs] = useState<HealingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isConnected, setIsConnected] = useState(true);
  const [chaosMessage, setChaosMessage] = useState<string | null>(null);
  const [chaosPending, setChaosPending] = useState(false);

  const fetchData = async () => {
    try {
      const [statusRes, healerRes, evalRes, logRes] = await Promise.allSettled([
        fetch(`${MONITOR_BASE}/status`),
        fetch(`${HEALER_BASE}/status`),
        fetch(`${EVALUATOR_BASE}/metrics`),
        fetch(`${HEALER_BASE}/healing-log`),
      ]);

      if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
        setSystemStatus(await statusRes.value.json());
      }
      if (healerRes.status === 'fulfilled' && healerRes.value.ok) {
        setHealerStatus(await healerRes.value.json());
      }
      if (evalRes.status === 'fulfilled' && evalRes.value.ok) {
        setEvalMetrics(await evalRes.value.json());
      }
      if (logRes.status === 'fulfilled' && logRes.value.ok) {
        const { logs } = await logRes.value.json();
        setHealingLogs(logs);
      }

      setIsConnected(true);
      setLastUpdate(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setIsConnected(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const triggerChaos = async (scenario: string) => {
    setChaosPending(true);
    setChaosMessage(null);
    try {
      const res = await fetch(`${HEALER_BASE}/chaos/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
      const data = await res.json();
      setChaosMessage(res.ok ? data.message : (data.error || 'Chaos trigger failed'));
    } catch (error) {
      setChaosMessage('Failed to reach the healer service');
    } finally {
      setChaosPending(false);
    }
  };

  const getOverallHealth = (): 'healthy' | 'degraded' | 'critical' => {
    if (!systemStatus) return 'critical';
    const services = Object.values(systemStatus.services);
    if (services.some(s => s.health === 'critical')) return 'critical';
    if (services.some(s => s.health === 'degraded')) return 'degraded';
    return 'healthy';
  };

  const overallHealth = getOverallHealth();
  const serviceCount = systemStatus ? Object.keys(systemStatus.services).length : 0;
  const healthyCount = systemStatus
    ? Object.values(systemStatus.services).filter(s => s.health === 'healthy').length
    : 0;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <header className="mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary text-primary-foreground">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-xl md:text-2xl font-semibold">Aegis Dashboard</h1>
                    <p className="text-muted-foreground text-sm">Self-Healing Distributed System Monitor</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant={isConnected ? 'outline' : 'destructive'}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-foreground animate-pulse' : 'bg-destructive-foreground'}`} />
                    {isConnected ? 'Live' : 'Disconnected'}
                  </Badge>

                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Clock className="w-4 h-4" />
                    <span>{lastUpdate.toLocaleTimeString()}</span>
                  </div>

                  <Button variant="outline" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </Button>

                  <Button onClick={fetchData} size="sm">
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </header>

        {/* Chaos Injection Controls */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center gap-2 shrink-0">
                <Zap className="w-5 h-5" />
                <h2 className="text-sm font-semibold whitespace-nowrap">Inject Chaos</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {CHAOS_SCENARIOS.map(({ key, label }) => (
                  <Button key={key} variant="outline" size="sm" disabled={chaosPending} onClick={() => triggerChaos(key)}>
                    {label}
                  </Button>
                ))}
              </div>
              {chaosMessage && <p className="text-sm text-muted-foreground md:ml-2">{chaosMessage}</p>}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-muted rounded-full" />
              <div className="absolute inset-0 w-16 h-16 border-4 border-t-transparent border-foreground rounded-full animate-spin" />
            </div>
            <p className="text-muted-foreground">Connecting to services...</p>
          </div>
        ) : (
          <>
            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className={overallHealth === 'critical' ? 'border-destructive' : undefined}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${overallHealth === 'critical' ? 'border-destructive' : ''}`}>
                    {overallHealth === 'healthy' ? <Heart className="w-5 h-5" /> : <AlertTriangle className={`w-5 h-5 ${overallHealth === 'critical' ? 'text-destructive' : ''}`} />}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">System Health</p>
                    <p className={`text-lg font-semibold capitalize ${overallHealth === 'critical' ? 'text-destructive' : ''}`}>{overallHealth}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl border"><Server className="w-5 h-5" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Services</p>
                    <p className="text-lg font-semibold">{healthyCount}<span className="text-muted-foreground">/{serviceCount}</span></p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl border"><Zap className="w-5 h-5" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Healer Rate</p>
                    <p className="text-lg font-semibold">{healerStatus?.stats.successRate || 'N/A'}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl border"><Activity className="w-5 h-5" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Anomalies</p>
                    <p className="text-lg font-semibold">{systemStatus?.totalAnomalies || 0}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Grid - Services */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Server className="w-5 h-5" />
                <h2 className="text-base font-semibold">Service Status</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {systemStatus && Object.entries(systemStatus.services).map(([name, service]) => (
                  <ServiceCard key={name} name={name} service={service} />
                ))}
              </div>
            </div>

            {/* Metrics and Evaluation Row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
              <MetricsPanel services={systemStatus?.services || {}} theme={theme} />
              <EvaluationMetrics evalMetrics={evalMetrics} healerStatus={healerStatus} theme={theme} />
            </div>

            {/* Anomalies and Timeline Row */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <AnomaliesPanel services={systemStatus?.services || {}} />
              <HealingTimeline logs={healingLogs} healerStatus={healerStatus} />
            </div>
          </>
        )}

        <footer className="mt-8 text-center text-muted-foreground text-sm">
          <p>Aegis Self-Healing System</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
