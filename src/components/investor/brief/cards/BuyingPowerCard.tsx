import type { BuyingPowerResult } from '@/lib/investorBrief/buyingPower';
import { cn } from '@/lib/utils';

interface Props {
  data: BuyingPowerResult;
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

export function BuyingPowerCard({ data }: Props) {
  if (data.perMarket.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        Add at least one target market in your preferences to see your buying power per market.
      </div>
    );
  }

  const max = data.buyingPower || 1;

  return (
    <div className="space-y-3">
      {data.perMarket.map((m) => {
        const youWidth = 100;
        const medianWidth = Math.min(140, Math.max(8, (m.medianListPrice / max) * 100));
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
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
                )}
              >
                {headroomPositive ? '+' : ''}
                {Math.round(m.headroomPct * 100)}% vs median ·{' '}
                {Math.round(m.affordabilityPct * 100)}% of listings
              </span>
            </div>
            <div className="space-y-1">
              <div className="relative h-3 rounded-sm bg-muted/40">
                <div
                  className="h-full rounded-sm bg-gradient-to-r from-primary to-primary/60"
                  style={{ width: `${youWidth}%` }}
                  title={`Your buying power: ${formatCurrency(data.buyingPower)}`}
                />
                <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-medium text-primary-foreground/95">
                  You · {formatCurrency(data.buyingPower)}
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
              {m.totalListings.toLocaleString()} active listings within reach.
            </p>
          </div>
        );
      })}
    </div>
  );
}