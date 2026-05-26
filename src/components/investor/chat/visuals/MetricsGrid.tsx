import { ToolCardShell, usd, pct } from './ToolCardShell';
import type { ToolEvent } from '@/lib/investorChat/turnTypes';

export function MetricsGrid({ event }: { event: ToolEvent }) {
  const o = event.output ?? {};
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
          <div key={it.label} className="rounded-md border p-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{it.label}</div>
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