import { Building2, TrendingUp } from 'lucide-react';
import { MetricWithSource } from '../MetricWithSource';
import type { CardSources } from '@/lib/investorBrief/sources';

interface Data {
  count: number;
  totalValue: number;
  totalEquity: number;
  totalAppreciation: number;
  rentedCount: number;
}

function fmt(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

export function PortfolioGlanceCard({ data, sources }: { data: Data; sources?: CardSources }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <Stat label="Properties" metric="count" sources={sources} value={String(data.count)} icon={<Building2 className="h-3.5 w-3.5" />} />
      <Stat label="Total value" metric="totalValue" sources={sources} value={fmt(data.totalValue)} />
      <Stat label="Equity" metric="totalEquity" sources={sources} value={fmt(data.totalEquity)} />
      <Stat
        label="Appreciation"
        metric="totalAppreciation"
        sources={sources}
        value={fmt(data.totalAppreciation)}
        icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-600" />}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  metric,
  sources,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  metric: string;
  sources?: CardSources;
}) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold mt-0.5">
        <MetricWithSource metric={metric} sources={sources}>{value}</MetricWithSource>
      </div>
    </div>
  );
}