import { ToolCardShell, usd } from './ToolCardShell';
import type { ToolEvent } from '@/lib/investorChat/turnTypes';

export function ComparableSales({ event }: { event: ToolEvent }) {
  const o = event.output ?? {};
  const comps: any[] = o.comps ?? [];
  return (
    <ToolCardShell anchor={event.anchor} status={event.status} error={event.error} id={`tool-${event.id}`}>
      {o.note && <div className="text-xs text-muted-foreground">{o.note}</div>}
      {comps.length > 0 ? (
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground">
            <tr className="border-b">
              <th className="text-left p-1.5">Address</th>
              <th className="text-right p-1.5">Sold</th>
              <th className="text-right p-1.5">Price</th>
              <th className="text-right p-1.5">$/sqft</th>
            </tr>
          </thead>
          <tbody>
            {comps.map((c: any, i: number) => (
              <tr key={i} className="border-b last:border-0">
                <td className="p-1.5">{c.address}</td>
                <td className="p-1.5 text-right">{c.soldDate}</td>
                <td className="p-1.5 text-right">{usd(c.price)}</td>
                <td className="p-1.5 text-right">{usd(c.pricePerSqft)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : !o.note ? (
        <div className="text-xs text-muted-foreground">No comps.</div>
      ) : null}
    </ToolCardShell>
  );
}