interface Mover { address: string; askPrice: number; arvEstimate: number; spreadPct: number }
interface Data { market: string; movers: Mover[] }

const fmt = (n: number) => `$${(n / 1000).toFixed(0)}k`;

export function FlipSpreadMoversCard({ data }: { data: Data }) {
  return (
    <div className="space-y-1.5">
      {data.movers.slice(0, 4).map((m) => (
        <div key={m.address} className="flex items-center justify-between text-xs rounded-md border px-2 py-1.5">
          <span className="font-medium truncate mr-2">{m.address}</span>
          <span className="text-muted-foreground whitespace-nowrap">
            {fmt(m.askPrice)} → {fmt(m.arvEstimate)} <span className="text-emerald-600 font-semibold">+{Math.round(m.spreadPct * 100)}%</span>
          </span>
        </div>
      ))}
    </div>
  );
}