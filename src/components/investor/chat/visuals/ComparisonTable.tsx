import { ToolCardShell, usd, pct } from './ToolCardShell';
import { cn } from '@/lib/utils';
import type { ToolEvent } from '@/lib/investorChat/turnTypes';

export function ComparisonTable({ event }: { event: ToolEvent }) {
  const o = event.output ?? {};
  const rows: any[] = o.rows ?? [];
  const winners: Record<string, string> = o.winnerByMetric ?? {};
  const Cell = ({ id, metric, children }: any) => (
    <td className={cn('p-1.5 text-right', winners[metric] === id && 'bg-emerald-500/10 font-semibold')}>
      {children}
    </td>
  );
  return (
    <ToolCardShell anchor={event.anchor} status={event.status} error={event.error} id={`tool-${event.id}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="text-left p-1.5">Property</th>
              <th className="text-right p-1.5">Price</th>
              <th className="text-right p-1.5">Cap</th>
              <th className="text-right p-1.5">CF / mo</th>
              <th className="text-right p-1.5">NOI</th>
              <th className="text-right p-1.5">$/sqft</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.propertyId} className="border-b last:border-0">
                <td className="p-1.5 truncate max-w-[180px]" title={r.address}>{r.address}</td>
                <td className="p-1.5 text-right">{usd(r.price)}</td>
                <Cell id={r.propertyId} metric="capRate">{pct(r.capRate, 1)}</Cell>
                <Cell id={r.propertyId} metric="monthlyCashFlow">{usd(r.monthlyCashFlow)}</Cell>
                <Cell id={r.propertyId} metric="noi">{usd(r.noi)}</Cell>
                <td className="p-1.5 text-right">{r.pricePerSqft ? usd(r.pricePerSqft) : '—'}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={6} className="text-center text-muted-foreground p-3">No properties.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </ToolCardShell>
  );
}