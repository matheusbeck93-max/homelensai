import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface MonthlyUsageCardProps {
  thisMonth: {
    usage_usd: number;
    monthly_limit_usd: number;
    usage_pct: number;
    days_remaining: number;
    projected_end_of_month_usd: number;
    projected_to_hit_cap: boolean;
    projected_cap_hit_date: string | null;
    reset_at: string;
  };
}

function fmtUsd(n: number) {
  return `$${n.toFixed(2)}`;
}

export function MonthlyUsageCard({ thisMonth }: MonthlyUsageCardProps) {
  return (
    <Card className="p-6">
      <h2 className="font-semibold text-lg">This month</h2>
      <div className="mt-3 flex items-baseline justify-between text-sm">
        <span>
          <strong className="text-xl">{fmtUsd(thisMonth.usage_usd)}</strong> of {fmtUsd(thisMonth.monthly_limit_usd)}
        </span>
        <span className="text-muted-foreground">
          {thisMonth.days_remaining} days remaining
        </span>
      </div>
      <Progress value={thisMonth.usage_pct} className="mt-2" />
      <p className="mt-3 text-sm">
        {thisMonth.projected_to_hit_cap
          ? `At your current pace, you'll hit the monthly cap around ${
              thisMonth.projected_cap_hit_date
                ? new Date(thisMonth.projected_cap_hit_date).toLocaleDateString()
                : "later this month"
            }.`
          : "You're well within your monthly limit — no action needed."}
      </p>
    </Card>
  );
}

export default MonthlyUsageCard;