import { ToolCardShell, num } from './ToolCardShell';
import type { ToolEvent } from '@/lib/investorChat/turnTypes';

export function AbsorptionRate({ event }: { event: ToolEvent }) {
  const o = event.output ?? {};
  const signal: string = o.signal ?? 'unknown';
  const tone =
    signal === 'seller' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' :
    signal === 'balanced' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' :
    signal === 'buyer' ? 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200' :
    'bg-muted text-muted-foreground';
  return (
    <ToolCardShell anchor={event.anchor} status={event.status} error={event.error} id={`tool-${event.id}`}>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Months of supply</div>
            <div className="text-2xl font-semibold">{o.monthsOfSupply ?? '—'}</div>
          </div>
          <span className={`text-[11px] font-semibold uppercase rounded-md px-2 py-1 ${tone}`}>
            {signal} market
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border p-2">
            <div className="text-[10px] text-muted-foreground">Active listings</div>
            <div className="font-semibold">{num(o.activeListings)}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-[10px] text-muted-foreground">Days on market (median)</div>
            <div className="font-semibold">{num(o.daysOnMarketMedian)}</div>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground">Source: {o.source}</div>
      </div>
    </ToolCardShell>
  );
}