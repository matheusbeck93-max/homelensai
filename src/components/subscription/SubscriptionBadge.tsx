import { Badge } from "@/components/ui/badge";
import { Crown, Sparkles } from "lucide-react";
import type { SubscriptionTier } from "@/lib/subscriptionPlans";

interface SubscriptionBadgeProps {
  tier: SubscriptionTier;
  variant?: "default" | "compact";
}

export function SubscriptionBadge({ tier, variant = "default" }: SubscriptionBadgeProps) {
  if (tier === 'free') {
    return null;
  }

  if (variant === "compact") {
    return (
      <Badge 
        variant="secondary" 
        className="text-xs bg-primary/10 text-primary border-primary/20"
      >
        <Crown className="h-3 w-3" />
      </Badge>
    );
  }

  return (
    <Badge 
      variant="secondary" 
      className="gap-1 bg-primary/10 text-primary border-primary/20"
    >
      <Crown className="h-3 w-3" />
      Premium
    </Badge>
  );
}
