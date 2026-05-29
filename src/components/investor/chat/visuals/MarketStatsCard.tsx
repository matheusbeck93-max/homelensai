import { ToolCardShell, usd, pct, num } from './ToolCardShell';
import type { ToolEvent } from '@/lib/investorChat/turnTypes';

export function MarketStatsCard({ event }: { event: ToolEvent }) {
  const o = event.output ?? {};
  if (o.error) {
    return (
      <ToolCardShell anchor={event.anchor} status="error" error={o.error} id={`tool-${event.id}`} />
    );
  }
  const items: { label: string; value: string; derived?: boolean }[] = [
    { label: 'Median price', value: usd(o.medianListPrice) },
    { label: 'Median sqft', value: num(o.medianSqft) },
    {
      label: 'Median $/sqft',
      value: usd(o.medianPricePerSqft),
      derived: o.medianPricePerSqftSource === 'derived',
    },
    { label: 'Median rent / mo', value: usd(o.medianRentMonthly) },
    {
      label: 'Median rent $/sqft',
      value: o.medianRentPerSqft != null ? `$${Number(o.medianRentPerSqft).toFixed(2)}` : '—',
      derived: o.medianRentPerSqftSource === 'derived',
    },
    { label: 'Appreciation YoY', value: pct(o.appreciationYoy, 1) },
    { label: 'Rent growth YoY', value: pct(o.rentGrowthYoy, 1) },
    { label: 'Vacancy', value: pct(o.vacancyRate, 1) },
    { label: 'DOM (median)', value: num(o.daysOnMarketMedian) },
    { label: 'Active listings', value: num(o.activeListings) },
  ].filter((it) => it.value !== '—' && it.value != null);
  return (
    <ToolCardShell anchor={event.anchor} status={event.status} error={event.error} id={`tool-${event.id}`}>
      <div className="text-xs font-medium">{o.market}</div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => (
          <div key={it.label} className="rounded-md border p-2">
            <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
              {it.label}
              {it.derived && (
                <span className="text-[9px] normal-case text-muted-foreground/80">·derived</span>
              )}
            </div>
            <div className="text-sm font-semibold">{it.value}</div>
          </div>
        ))}
      </div>
      {o.source && (
        <div className="text-[10px] text-muted-foreground">Source: {o.source}</div>
      )}
    </ToolCardShell>
  );
}