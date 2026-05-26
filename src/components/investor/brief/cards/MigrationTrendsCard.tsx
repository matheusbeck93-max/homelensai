import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';

interface Data {
  market: string;
  netMigrationYearly: Array<{ year: number; netMigration: number }>;
  indicator: 'in' | 'out' | 'flat';
}

export function MigrationTrendsCard({ data }: { data: Data }) {
  const tone = data.indicator === 'in' ? 'text-emerald-600' : data.indicator === 'out' ? 'text-destructive' : 'text-muted-foreground';
  return (
    <div className="space-y-2">
      <div className={`text-[11px] font-semibold uppercase ${tone}`}>
        {data.indicator === 'in' ? 'Net inbound' : data.indicator === 'out' ? 'Net outbound' : 'Flat'}
      </div>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.netMigrationYearly}>
            <XAxis dataKey="year" fontSize={9} />
            <Tooltip />
            <Bar dataKey="netMigration" fill="hsl(var(--primary))" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}