import { ToolCardShell } from './ToolCardShell';
import type { ToolEvent } from '@/lib/investorChat/turnTypes';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export function MigrationTrend({ event }: { event: ToolEvent }) {
  const o = event.output ?? {};
  const data = (o.series ?? []).map((r: any) => ({ year: r.year, net: r.netMigration }));
  const indicator: string = o.indicator ?? 'flat';
  const tone = indicator === 'in' ? 'text-emerald-600' : indicator === 'out' ? 'text-destructive' : 'text-muted-foreground';
  return (
    <ToolCardShell anchor={event.anchor} status={event.status} error={event.error} id={`tool-${event.id}`}>
      <div className="space-y-2">
        <div className={`text-xs font-semibold uppercase ${tone}`}>
          {indicator === 'in' ? 'Net inbound' : indicator === 'out' ? 'Net outbound' : 'Flat'} · {o.market}
        </div>
        {data.length > 0 ? (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <XAxis dataKey="year" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Bar dataKey="net" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No migration series available.</div>
        )}
        {o.summary && <p className="text-xs">{o.summary}</p>}
      </div>
    </ToolCardShell>
  );
}