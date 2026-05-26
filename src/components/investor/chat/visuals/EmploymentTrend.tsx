import { ToolCardShell } from './ToolCardShell';
import type { ToolEvent } from '@/lib/investorChat/turnTypes';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

export function EmploymentTrend({ event }: { event: ToolEvent }) {
  const o = event.output ?? {};
  const data = (o.series ?? []).map((p: any) => ({ period: p.period, rate: p.unemploymentRate }));
  const trend: string = o.trend ?? 'flat';
  const tone = trend === 'improving' ? 'text-emerald-600' : trend === 'worsening' ? 'text-destructive' : 'text-muted-foreground';
  return (
    <ToolCardShell anchor={event.anchor} status={event.status} error={event.error} id={`tool-${event.id}`}>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Latest unemployment</div>
            <div className="text-xl font-semibold">{o.latestUnemploymentRate != null ? `${o.latestUnemploymentRate.toFixed(1)}%` : '—'}</div>
          </div>
          <div className={`text-xs font-semibold uppercase ${tone}`}>{trend}</div>
        </div>
        {data.length > 0 ? (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <XAxis dataKey="period" fontSize={9} hide />
                <YAxis fontSize={10} />
                <Tooltip />
                <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No employment series available.</div>
        )}
        <div className="text-[10px] text-muted-foreground">{o.stateAbbrev ? `BLS LAUS · ${o.stateAbbrev}` : `Source: ${o.source ?? 'unknown'}`}</div>
      </div>
    </ToolCardShell>
  );
}