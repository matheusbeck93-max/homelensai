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

  const isPremium = tier === 'premium';
  
  if (variant === "compact") {
    return (
      <Badge 
        variant="secondary" 
        className={`text-xs ${isPremium ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-primary/10 text-primary border-primary/20'}`}
      >
        {isPremium ? (
          <Crown className="h-3 w-3" />
        ) : (
          <Sparkles className="h-3 w-3" />
        )}
      </Badge>
    );
  }

  return (
    <Badge 
      variant="secondary" 
      className={`gap-1 ${isPremium ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-primary/10 text-primary border-primary/20'}`}
    >
      {isPremium ? (
        <>
          <Crown className="h-3 w-3" />
          Premium
        </>
      ) : (
        <>
          <Sparkles className="h-3 w-3" />
          Pro
        </>
      )}
    </Badge>
  );
}
