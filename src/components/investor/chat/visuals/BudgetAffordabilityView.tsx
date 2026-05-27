import { ToolCardShell, usd, num } from './ToolCardShell';
import type { ToolEvent } from '@/lib/investorChat/turnTypes';

export function BudgetAffordabilityView({ event }: { event: ToolEvent }) {
  const o = event.output ?? {};
  const markets: any[] = o.perMarket ?? o.markets ?? [];
  return (
    <ToolCardShell anchor={event.anchor} status={event.status} error={event.error} id={`tool-${event.id}`}>
      <div className="text-xs text-muted-foreground">
        Budget: <span className="font-semibold text-foreground">{usd(o.budgetMax)}</span>
        {o.budgetMin ? <> {' · '}Min <span className="font-semibold text-foreground">{usd(o.budgetMin)}</span></> : null}
      </div>
      <div className="space-y-2 pt-2">
        {markets.map((m: any) => {
          const positive = (m.headroomPct ?? 0) >= 0;
          return (
            <div key={m.market ?? m.name} className="rounded-md border p-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{m.market ?? m.name}</div>
                <div className={`text-xs ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {positive ? '+' : ''}{Math.round((m.headroomPct ?? 0) * 100)}% vs median
                </div>
              </div>
              <div className="mt-1 h-1.5 rounded bg-muted/40 overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.min(100, ((m.listingsAffordable ?? 0) / Math.max(1, m.totalListings)) * 100)}%` }}
                />
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {num(m.listingsAffordable)} / {num(m.totalListings)} listings within budget · Median {usd(m.medianListPrice)}
              </div>
            </div>
          );
        })}
      </div>
    </ToolCardShell>
  );
}