import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface UsageHeroProps {
  tierDisplayName: string;
  today: {
    usage_usd: number;
    daily_limit_usd: number;
    usage_pct: number;
    remaining_turns_estimate: number;
    reset_at: string;
  };
}

function fmtUsd(n: number) {
  return `$${n.toFixed(2)}`;
}

export function UsageHero({ tierDisplayName, today }: UsageHeroProps) {
  return (
    <Card className="p-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-lg">
          Today — {tierDisplayName} plan
        </h2>
        <span className="text-sm text-muted-foreground">
          Resets {new Date(today.reset_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </span>
      </div>
      <div className="mt-3 flex items-baseline justify-between text-sm">
        <span>
          <strong className="text-xl">{fmtUsd(today.usage_usd)}</strong> used
        </span>
        <span className="text-muted-foreground">
          {fmtUsd(Math.max(0, today.daily_limit_usd - today.usage_usd))} remaining
        </span>
      </div>
      <Progress value={today.usage_pct} className="mt-2" />
      <p className="mt-2 text-sm text-muted-foreground">
        ~{today.remaining_turns_estimate} chat turns remaining today
      </p>
    </Card>
  );
}

export default UsageHero;