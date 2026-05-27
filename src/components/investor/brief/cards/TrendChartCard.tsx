import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { CardSourceFooter } from '../MetricWithSource';
import type { CardSources } from '@/lib/investorBrief/sources';

interface Props {
  data: { market: string; series: Array<{ month: string; capRate: number }>; current: number; target: number };
  sources?: CardSources;
}

export function TrendChartCard({ data, sources }: Props) {
  return (
    <div>
      <div className="h-40 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={(m) => m.slice(5)} />
          <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} width={32} />
          <Tooltip
            contentStyle={{ fontSize: 12, padding: '4px 8px' }}
            formatter={(v: number) => [`${v}%`, 'Cap rate']}
          />
          <ReferenceLine y={data.target} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="capRate"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
        </ResponsiveContainer>
      </div>
      <CardSourceFooter sources={sources} />
    </div>
  );
}
