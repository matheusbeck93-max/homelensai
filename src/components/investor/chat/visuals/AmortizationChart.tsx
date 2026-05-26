import { ToolCardShell, usd } from './ToolCardShell';
import type { ToolEvent } from '@/lib/investorChat/turnTypes';

export function AmortizationChart({ event }: { event: ToolEvent }) {
  const o = event.output ?? {};
  const rows: any[] = o.years ?? [];
  const max = Math.max(1, ...rows.map((r: any) => (r.principal ?? 0) + (r.interest ?? 0)));
  return (
    <ToolCardShell anchor={event.anchor} status={event.status} error={event.error} id={`tool-${event.id}`}>
      <div className="text-xs text-muted-foreground">
        Loan {usd(o.loanAmount)} · Total interest {usd(o.totalInterest)}
      </div>
      <div className="space-y-1 pt-1 max-h-60 overflow-y-auto pr-1">
        {rows.map((r: any) => {
          const total = (r.principal ?? 0) + (r.interest ?? 0);
          const pw = (r.principal / max) * 100;
          const iw = (r.interest / max) * 100;
          return (
            <div key={r.year} className="flex items-center gap-2 text-[11px]">
              <span className="w-6 text-muted-foreground">Y{r.year}</span>
              <div className="flex-1 h-2 rounded bg-muted/40 overflow-hidden flex">
                <div className="h-full bg-primary" style={{ width: `${pw}%` }} />
                <div className="h-full bg-amber-500/70" style={{ width: `${iw}%` }} />
              </div>
              <span className="w-20 text-right text-muted-foreground">{usd(r.balance)}</span>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-muted-foreground flex gap-3">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 bg-primary rounded-sm" />Principal</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 bg-amber-500/70 rounded-sm" />Interest</span>
      </div>
    </ToolCardShell>
  );
}