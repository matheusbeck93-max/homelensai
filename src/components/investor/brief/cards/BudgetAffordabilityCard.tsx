import type { BudgetAffordabilityResult } from '@/lib/investorBrief/budgetAffordability';
import { cn } from '@/lib/utils';

interface Props {
  data: BudgetAffordabilityResult;
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

export function BudgetAffordabilityCard({ data }: Props) {
  if (data.perMarket.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        Add at least one target market in your preferences to compare your budget against the market.
      </div>
    );
  }

  const max = Math.max(data.budgetMax, ...data.perMarket.map((m) => m.medianListPrice));
  const scale = max || 1;

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted-foreground">
        Budget from preferences: Max {formatCurrency(data.budgetMax)}
        {data.budgetMin ? ` · Min ${formatCurrency(data.budgetMin)}` : ''}
      </div>
      {data.perMarket.map((m) => {
        const budgetWidth = Math.min(100, Math.max(8, (data.budgetMax / scale) * 100));
        const medianWidth = Math.min(100, Math.max(8, (m.medianListPrice / scale) * 100));
        const headroomPositive = m.headroomPct >= 0;
        return (
          <div key={m.market} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium truncate">{m.market}</span>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                  headroomPositive
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
                )}
              >
                {headroomPositive ? '+' : ''}
                {Math.round(m.headroomPct * 100)}% vs median ·{' '}
                covers {Math.round(m.affordabilityPct * 100)}%
              </span>
            </div>
            <div className="space-y-1">
              <div className="relative h-3 rounded-sm bg-muted/40">
                <div
                  className="h-full rounded-sm bg-gradient-to-r from-primary to-primary/60"
                  style={{ width: `${budgetWidth}%` }}
                  title={`Your budget: ${formatCurrency(data.budgetMax)}`}
                />
                <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-medium text-primary-foreground/95">
                  Budget · {formatCurrency(data.budgetMax)}
                </span>
              </div>
              <div className="relative h-3 rounded-sm bg-muted/40">
                <div
                  className="h-full rounded-sm bg-muted-foreground/40"
                  style={{ width: `${medianWidth}%` }}
                  title={`Median: ${formatCurrency(m.medianListPrice)}`}
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-foreground/80">
                  Median · {formatCurrency(m.medianListPrice)}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {m.listingsAffordable.toLocaleString()} of{' '}
              {m.totalListings.toLocaleString()} active listings within budget.
            </p>
          </div>
        );
      })}
    </div>
  );
}