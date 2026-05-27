import { Bell, TrendingUp, AlertTriangle, Info } from 'lucide-react';

interface Alert {
  id: string;
  property_id: string;
  alert_type: string;
  severity: 'info' | 'opportunity' | 'warning';
  title: string;
  description: string;
}

const ICONS = {
  opportunity: TrendingUp,
  warning: AlertTriangle,
  info: Info,
} as const;

const TONE = {
  opportunity: 'text-emerald-600',
  warning: 'text-amber-600',
  info: 'text-sky-600',
} as const;

export function PortfolioAlertsCard({ data }: { data: { alerts: Alert[] } }) {
  if (!data.alerts.length) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Bell className="h-3.5 w-3.5" />
        No active alerts.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {data.alerts.map((a) => {
        const Icon = ICONS[a.severity] ?? Info;
        return (
          <li key={a.id} className="flex items-start gap-2 text-xs">
            <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${TONE[a.severity] ?? ''}`} />
            <div className="min-w-0">
              <div className="font-medium text-foreground">{a.title}</div>
              <div className="text-muted-foreground line-clamp-2">{a.description}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}