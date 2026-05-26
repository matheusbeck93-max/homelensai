import { ToolCardShell, usd, pct } from './ToolCardShell';
import type { ToolEvent } from '@/lib/investorChat/turnTypes';

export function FlipSpread({ event }: { event: ToolEvent }) {
  const o = event.output ?? {};
  const signal: string = o.signal ?? 'unknown';
  const signalTone =
    signal === 'go' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' :
    signal === 'marginal' ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' :
    'bg-destructive/10 text-destructive';
  return (
    <ToolCardShell anchor={event.anchor} status={event.status} error={event.error} id={`tool-${event.id}`}>
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Gross profit</div>
            <div className="text-xl font-semibold">{usd(o.grossProfit)}</div>
          </div>
          <span className={`text-[11px] font-semibold uppercase rounded-md px-2 py-1 ${signalTone}`}>
            {signal.replace('_', ' ')}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Row label="Purchase" value={usd(o.purchasePrice)} />
          <Row label="Renovation" value={usd(o.renovationCost)} />
          <Row label="Selling cost" value={usd(o.sellingCost)} />
          <Row label="Carrying ({o.holdMonths}mo)" value={usd(o.carryingCost)} />
          <Row label="ARV" value={usd(o.arv)} />
          <Row label="ROI" value={pct(o.roi, 1)} />
        </div>
      </div>
    </ToolCardShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}