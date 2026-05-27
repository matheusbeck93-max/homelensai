import { Building2, TrendingUp } from 'lucide-react';

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

export function PortfolioGlanceCard({ data }: { data: Data }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <Stat label="Properties" value={String(data.count)} icon={<Building2 className="h-3.5 w-3.5" />} />
      <Stat label="Total value" value={fmt(data.totalValue)} />
      <Stat label="Equity" value={fmt(data.totalEquity)} />
      <Stat
        label="Appreciation"
        value={fmt(data.totalAppreciation)}
        icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-600" />}
      />
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}