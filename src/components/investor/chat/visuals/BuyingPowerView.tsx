import { ToolCardShell, usd, num } from './ToolCardShell';
import type { ToolEvent } from '@/lib/investorChat/turnTypes';

export function BuyingPowerView({ event }: { event: ToolEvent }) {
  const o = event.output ?? {};
  const markets: any[] = o.markets ?? [];
  return (
    <ToolCardShell anchor={event.anchor} status={event.status} error={event.error} id={`tool-${event.id}`}>
      <div className="text-xs text-muted-foreground">
        Max purchase: <span className="font-semibold text-foreground">{usd(o.maxPurchasePrice)}</span>
        {' · '}Down: <span className="font-semibold text-foreground">{usd(o.downPayment)}</span>
      </div>
      <div className="space-y-2 pt-2">
        {markets.map((m: any) => (
          <div key={m.name} className="rounded-md border p-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">{m.name}</div>
              <div className="text-xs text-muted-foreground">
                {num(m.affordableCount)} / {num(m.totalListings)} listings
              </div>
            </div>
            <div className="mt-1 h-1.5 rounded bg-muted/40 overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.min(100, ((m.affordableCount ?? 0) / Math.max(1, m.totalListings)) * 100)}%` }}
              />
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Median {usd(m.medianListPrice)}
            </div>
          </div>
        ))}
      </div>
    </ToolCardShell>
  );
}