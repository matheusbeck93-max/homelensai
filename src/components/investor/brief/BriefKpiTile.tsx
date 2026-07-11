import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type KpiAccent = 'blue' | 'green' | 'purple' | 'amber';

const ACCENT_BAR: Record<KpiAccent, string> = {
  blue: 'bg-sky-500',
  green: 'bg-emerald-500',
  purple: 'bg-violet-500',
  amber: 'bg-amber-500',
};

const ACCENT_ICON: Record<KpiAccent, string> = {
  blue: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  purple: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

interface Props {
  label: string;
  value: string;
  context?: string;
  trend?: string;
  accent: KpiAccent;
  icon: LucideIcon;
}

export function BriefKpiTile({ label, value, context, trend, accent, icon: Icon }: Props) {
  return (
    <div className="dash-card relative overflow-hidden p-5">
      <div className={cn('absolute inset-x-0 top-0 h-0.5', ACCENT_BAR[accent])} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">
          {label}
        </p>
        <span
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-md',
            ACCENT_ICON[accent],
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </div>
      {context && (
        <p className="mt-1 text-xs text-muted-foreground truncate">{context}</p>
      )}
      {trend && (
        <p className="mt-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          {trend}
        </p>
      )}
    </div>
  );
}