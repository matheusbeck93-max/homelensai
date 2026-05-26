import { ToolCardShell, usd, pct } from './ToolCardShell';
import type { ToolEvent } from '@/lib/investorChat/turnTypes';

export function AffordabilityIndex({ event }: { event: ToolEvent }) {
  const o = event.output ?? {};
  const score: number = o.score ?? 0;
  const tone = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-destructive';
  return (
    <ToolCardShell anchor={event.anchor} status={event.status} error={event.error} id={`tool-${event.id}`}>
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Max price</div>
            <div className="text-lg font-semibold">{usd(o.maxPrice)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Score</div>
            <div className="text-lg font-semibold">{score}/100</div>
          </div>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full ${tone}`} style={{ width: `${score}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border p-2">
            <div className="text-[10px] text-muted-foreground">P&amp;I / mo</div>
            <div className="font-semibold">{usd(o.piti?.principalInterest)}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-[10px] text-muted-foreground">Tax / mo</div>
            <div className="font-semibold">{usd(o.piti?.tax)}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-[10px] text-muted-foreground">Insurance / mo</div>
            <div className="font-semibold">{usd(o.piti?.insurance)}</div>
          </div>
          <div className="rounded-md border p-2">
            <div className="text-[10px] text-muted-foreground">PITI total</div>
            <div className="font-semibold">{usd(o.piti?.total)}</div>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground">
          Front-end DTI {pct(o.dti?.front, 1)} · Back-end DTI {pct(o.dti?.back, 1)}
        </div>
        {o.note && <p className="text-[11px] text-muted-foreground">{o.note}</p>}
      </div>
    </ToolCardShell>
  );
}