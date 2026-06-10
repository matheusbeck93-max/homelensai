import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { emitUsageEvent } from "@/lib/telemetry/usageEvents";
import { useBudgetCap } from "@/lib/ai/budgetCap";

interface NextTierCompareProps {
  nextTier: {
    name: "buyer" | "investor";
    display_name: string;
    price_usd: number;
    daily_limit_usd: number;
    monthly_limit_usd: number;
    additional_features: string[];
    checkout_url: string;
  };
}

function fmtUsd(n: number) {
  return `$${n.toFixed(2)}`;
}

export function NextTierCompare({ nextTier }: NextTierCompareProps) {
  const cap = useBudgetCap();
  const handleClick = () => {
    emitUsageEvent("homelens:upgrade_cta_clicked", {
      tier: cap.tier,
      source: "next_tier_compare",
      to_tier: nextTier.name,
    });
  };

  return (
    <Card className="p-6">
      <h2 className="font-semibold text-lg">
        Upgrade to {nextTier.display_name} — ${nextTier.price_usd}/mo
      </h2>
      <ul className="mt-3 space-y-1 text-sm">
        <li>Daily: {fmtUsd(nextTier.daily_limit_usd)}</li>
        <li>Monthly: {fmtUsd(nextTier.monthly_limit_usd)}</li>
        {nextTier.additional_features.map((f) => (
          <li key={f}>• {f}</li>
        ))}
      </ul>
      <Button asChild className="mt-4" onClick={handleClick}>
        <Link to={nextTier.checkout_url}>Upgrade</Link>
      </Button>
    </Card>
  );
}

export default NextTierCompare;