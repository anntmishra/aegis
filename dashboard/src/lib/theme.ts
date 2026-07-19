import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'aegis-theme';

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return { theme, toggleTheme };
}

// Real backend severities are low/medium/high/critical (src/shared/types.ts
// AnomalySeverity). Only "critical" earns the one reserved red — everything
// else is conveyed by badge fill (secondary/outline), never by hue.
export function severityVariant(severity: string): 'destructive' | 'secondary' | 'outline' {
  switch (severity.toLowerCase()) {
    case 'critical': return 'destructive';
    case 'high': return 'secondary';
    default: return 'outline'; // medium, low
  }
}

export function healthVariant(health: 'healthy' | 'degraded' | 'critical'): 'outline' | 'secondary' | 'destructive' {
  if (health === 'healthy') return 'outline';
  if (health === 'degraded') return 'secondary';
  return 'destructive';
}

// Recharts needs literal color strings per render, not a live CSS var, so
// this mirrors the current --foreground / --destructive tokens per theme.
const INK: Record<Theme, string> = { light: '#0a0a0a', dark: '#fafafa' };
export const DESTRUCTIVE_HEX: Record<Theme, string> = { light: '#b91c1c', dark: '#e35252' };

// One hue (grayscale ink), three opacities — a sequential ramp for a single
// metric's percentiles (P50/P95/P99), not a status judgment across them.
export function monoRamp(theme: Theme): [string, string, string] {
  const ink = INK[theme];
  return [`${ink}4d`, `${ink}99`, ink]; // ~30%, ~60%, 100% alpha
}

export function monoFill(theme: Theme): string {
  return INK[theme];
}
