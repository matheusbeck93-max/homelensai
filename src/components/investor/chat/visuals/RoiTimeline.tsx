import { ToolCardShell, usd, pct } from './ToolCardShell';
import type { ToolEvent } from '@/lib/investorChat/turnTypes';

export function RoiTimeline({ event }: { event: ToolEvent }) {
  const o = event.output ?? {};
  const years: any[] = o.years ?? [];
  const maxCF = Math.max(1, ...years.map((y: any) => Math.abs(y.cashFlow ?? 0)));
  return (
    <ToolCardShell anchor={event.anchor} status={event.status} error={event.error} id={`tool-${event.id}`}>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Stat label="IRR" value={pct(o.irr, 1)} />
        <Stat label="Total return" value={usd(o.totalReturn)} />
        <Stat label="Hold" value={`${o.holdYears ?? '—'} yrs`} />
      </div>
      <div className="space-y-1.5 pt-1">
        {years.map((y: any) => {
          const w = Math.min(100, (Math.abs(y.cashFlow) / maxCF) * 100);
          const positive = y.cashFlow >= 0;
          return (
            <div key={y.year} className="flex items-center gap-2 text-[11px]">
              <span className="w-6 text-muted-foreground">Y{y.year}</span>
              <div className="flex-1 h-2 bg-muted/40 rounded overflow-hidden">
                <div className={positive ? 'h-full bg-emerald-500' : 'h-full bg-destructive'} style={{ width: `${w}%` }} />
              </div>
              <span className="w-20 text-right font-medium">{usd(y.cashFlow)}</span>
              <span className="w-20 text-right text-muted-foreground">{usd(y.equity)}</span>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-muted-foreground flex justify-end gap-4 pt-1">
        <span>Cash flow</span><span>Equity</span>
      </div>
    </ToolCardShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}