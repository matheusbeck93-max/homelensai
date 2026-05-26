import { ToolCardShell, usd } from './ToolCardShell';
import type { ToolEvent } from '@/lib/investorChat/turnTypes';

export function ArvEstimate({ event }: { event: ToolEvent }) {
  const o = event.output ?? {};
  return (
    <ToolCardShell anchor={event.anchor} status={event.status} error={event.error} id={`tool-${event.id}`}>
      <div className="space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">ARV estimate</div>
          <div className="text-2xl font-semibold">{usd(o.arv)}</div>
          <div className="text-[11px] text-muted-foreground">
            Range {usd(o.range?.low)} – {usd(o.range?.high)} · {usd(o.pricePerSqft)}/sqft
          </div>
        </div>
        <div className="flex gap-2 text-[11px]">
          <span className="rounded-md border px-2 py-1">Tier: {o.renovationTier}</span>
          <span className="rounded-md border px-2 py-1">Market: {o.market}</span>
          <span className="rounded-md border px-2 py-1">Source: {o.source}</span>
        </div>
        {o.note && <p className="text-[11px] text-muted-foreground">{o.note}</p>}
      </div>
    </ToolCardShell>
  );
}