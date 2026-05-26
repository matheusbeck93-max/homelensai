import { ToolCardShell, num } from './ToolCardShell';
import type { ToolEvent } from '@/lib/investorChat/turnTypes';

export function SupplyPipeline({ event }: { event: ToolEvent }) {
  const o = event.output ?? {};
  return (
    <ToolCardShell anchor={event.anchor} status={event.status} error={event.error} id={`tool-${event.id}`}>
      <div className="space-y-3">
        <div className="text-[11px] text-muted-foreground">{o.market}{o.stateAbbrev ? ` · ${o.stateAbbrev}` : ''}</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border p-2">
            <div className="text-[10px] uppercase text-muted-foreground">Permits (12 mo)</div>
            <div className="text-lg font-semibold">{num(o.permits12mo)}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-[10px] uppercase text-muted-foreground">Housing starts</div>
            <div className="text-lg font-semibold">{num(o.housingStarts)}</div>
          </div>
        </div>
        {o.note && <p className="text-[11px] text-muted-foreground">{o.note}</p>}
        <div className="text-[10px] text-muted-foreground">Source: {o.source}</div>
      </div>
    </ToolCardShell>
  );
}