import { ToolCardShell, usd, pct } from './ToolCardShell';
import type { ToolEvent } from '@/lib/investorChat/turnTypes';

export function PropertyTable({ event }: { event: ToolEvent }) {
  const o = event.output ?? {};
  const rows: any[] = o.listings ?? [];
  return (
    <ToolCardShell anchor={event.anchor} status={event.status} error={event.error} id={`tool-${event.id}`}>
      <div className="text-xs text-muted-foreground">
        {rows.length} listings{o.market ? ` in ${o.market}` : ''}
      </div>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="text-left p-1.5">Address</th>
              <th className="text-right p-1.5">Price</th>
              <th className="text-right p-1.5">Bd/Ba</th>
              <th className="text-right p-1.5">Sqft</th>
              <th className="text-right p-1.5">Cap</th>
              <th className="text-right p-1.5">DOM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="p-1.5 truncate max-w-[180px]" title={r.address}>{r.address}</td>
                <td className="p-1.5 text-right font-medium">{usd(r.price)}</td>
                <td className="p-1.5 text-right">{r.beds ?? '—'}/{r.baths ?? '—'}</td>
                <td className="p-1.5 text-right">{r.sqft ?? '—'}</td>
                <td className="p-1.5 text-right">{pct(r.capRate, 1)}</td>
                <td className="p-1.5 text-right">{r.daysOnMarket ?? '—'}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={6} className="text-center text-muted-foreground p-3">No listings.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </ToolCardShell>
  );
}