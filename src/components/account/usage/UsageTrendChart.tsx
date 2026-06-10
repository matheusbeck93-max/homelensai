import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface UsageTrendChartProps {
  data: Array<{ date: string; usage_usd: number }>;
}

export function UsageTrendChart({ data }: UsageTrendChartProps) {
  if (!data || data.length === 0) return null;

  const chartData = data.map((d) => ({
    date: d.date.slice(5), // MM-DD
    usd: Number(d.usage_usd.toFixed(4)),
  }));

  return (
    <Card className="p-6">
      <h2 className="font-semibold text-lg">Daily usage (last 30 days)</h2>
      <div className="mt-4 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
              width={48}
            />
            <Tooltip
              formatter={(value: number) => [`$${value.toFixed(4)}`, "Usage"]}
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="usd"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export default UsageTrendChart;