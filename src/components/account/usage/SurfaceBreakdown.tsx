import { Card } from "@/components/ui/card";

interface SurfaceBreakdownProps {
  surfaces: Array<{ surface: string; calls: number; usage_usd: number }>;
}

function fmtUsd(n: number) {
  return `$${n.toFixed(2)}`;
}

export function SurfaceBreakdown({ surfaces }: SurfaceBreakdownProps) {
  if (!surfaces || surfaces.length === 0) return null;
  return (
    <Card className="p-6">
      <h2 className="font-semibold text-lg">Where your AI usage goes (30 days)</h2>
      <ul className="mt-3 space-y-2">
        {surfaces.slice(0, 8).map((s) => (
          <li key={s.surface} className="flex items-center justify-between text-sm">
            <span className="capitalize">{s.surface.replace(/_/g, " ")}</span>
            <span className="text-muted-foreground">
              {fmtUsd(s.usage_usd)} · {s.calls} calls
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default SurfaceBreakdown;