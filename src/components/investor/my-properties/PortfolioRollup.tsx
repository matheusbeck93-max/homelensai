import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, DollarSign, Percent, Wallet, AlertTriangle } from 'lucide-react';
import type { PortfolioRollup as PortfolioRollupType } from '@/lib/myProperties/types';

function fmtMoney(n: number, compact = true): string {
  if (!Number.isFinite(n)) return '$0';
  const absN = Math.abs(n);
  if (compact && absN >= 1_000_000) return `${n < 0 ? '-' : ''}$${(absN / 1_000_000).toFixed(2)}M`;
  if (compact && absN >= 1_000) return `${n < 0 ? '-' : ''}$${Math.round(absN / 1_000)}k`;
  return `${n < 0 ? '-' : ''}$${Math.round(absN).toLocaleString()}`;
}
function fmtPct(n: number | null, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

interface Props {
  rollup: PortfolioRollupType;
}

export function PortfolioRollup({ rollup }: Props) {
  const stats = [
    { label: 'Total equity', value: fmtMoney(rollup.totalEquity), icon: Wallet },
    {
      label: 'Monthly cash flow',
      value: fmtMoney(rollup.totalMonthlyCashFlow, false),
      icon: DollarSign,
      tone:
        rollup.totalMonthlyCashFlow > 0
          ? 'text-emerald-600'
          : rollup.totalMonthlyCashFlow < 0
            ? 'text-destructive'
            : 'text-foreground',
    },
    { label: 'Weighted cap rate', value: fmtPct(rollup.weightedAvgCapRate, 2), icon: Percent },
    {
      label: 'Total appreciation',
      value: fmtMoney(rollup.totalAppreciation),
      icon: TrendingUp,
      tone:
        rollup.totalAppreciation > 0
          ? 'text-emerald-600'
          : rollup.totalAppreciation < 0
            ? 'text-destructive'
            : 'text-foreground',
    },
  ];

  const concentrationWarn =
    rollup.topMarketShare && rollup.topMarketShare.pct > 0.5 && rollup.count > 1;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <s.icon className="h-3.5 w-3.5" />
                {s.label}
              </div>
              <div className={`mt-1.5 text-2xl font-semibold ${s.tone ?? 'text-foreground'}`}>
                {s.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {rollup.topMarketShare && (
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="secondary" className="font-normal">
            Top market: {rollup.topMarketShare.market} ·{' '}
            {(rollup.topMarketShare.pct * 100).toFixed(0)}%
          </Badge>
          {concentrationWarn && (
            <span className="inline-flex items-center gap-1 text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              Heavy concentration in a single market
            </span>
          )}
        </div>
      )}
    </div>
  );
}