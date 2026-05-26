import { ToolCardShell, usd, pct } from './ToolCardShell';
import type { ToolEvent } from '@/lib/investorChat/turnTypes';
import { useCurrentPersona } from '@/lib/personas/useCurrentPersona';
import { cn } from '@/lib/utils';

/** Map persona priority KPI keywords to MetricsGrid item labels. */
const PERSONA_HIGHLIGHTS: Record<string, string[]> = {
  first_time_buyer: [],
  rental_investor: ['Cap rate', 'Cash-on-cash', 'NOI (annual)', 'Cash flow / mo'],
  flipper: [],
  institutional: ['Cap rate', 'NOI (annual)'],
  mixed: ['Cap rate', 'Cash flow / mo'],
};

export function MetricsGrid({ event }: { event: ToolEvent }) {
  const o = event.output ?? {};
  const { persona } = useCurrentPersona();
  const highlights = new Set(PERSONA_HIGHLIGHTS[persona] ?? []);
  const items = [
    { label: 'Cap rate', value: pct(o.capRate, 2) },
    { label: 'Cash-on-cash', value: pct(o.cashOnCash, 2) },
    { label: 'NOI (annual)', value: usd(o.noi) },
    { label: 'Cash flow / mo', value: usd(o.monthlyCashFlow) },
    { label: 'Debt service / mo', value: usd(o.monthlyDebtService) },
    { label: 'Expenses / mo', value: usd(o.totalMonthlyExpenses) },
  ];
  return (
    <ToolCardShell anchor={event.anchor} status={event.status} error={event.error} id={`tool-${event.id}`}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map((it) => (
          <div
            key={it.label}
            className={cn(
              'rounded-md border p-2 transition-colors',
              highlights.has(it.label) && 'border-primary/60 bg-primary/5',
            )}
          >
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              {it.label}
              {highlights.has(it.label) && (
                <span className="text-[8px] font-semibold text-primary uppercase">★</span>
              )}
            </div>
            <div className="text-sm font-semibold">{it.value}</div>
          </div>
        ))}
      </div>
      {o.assumptions && (
        <details className="text-[11px] text-muted-foreground mt-1">
          <summary className="cursor-pointer">Assumptions</summary>
          <div className="grid grid-cols-2 gap-1 pt-2">
            <span>Price</span><span>{usd(o.assumptions.price)}</span>
            <span>Rent / mo</span><span>{usd(o.assumptions.monthlyRent)}</span>
            <span>Down</span><span>{pct(o.assumptions.downPct)}</span>
            <span>Rate</span><span>{pct(o.assumptions.rateApr, 2)}</span>
          </div>
        </details>
      )}
    </ToolCardShell>
  );
}