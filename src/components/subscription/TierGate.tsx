import { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/hooks/useSubscription";
import {
  FEATURE_GATES,
  type FeatureKey,
  type SubscriptionTier,
} from "@/lib/subscriptionPlans";

interface TierGateProps {
  feature: FeatureKey;
  featureName: string;
  children: ReactNode;
  /** Show the gated UI behind blur + lock overlay (default) vs. plain card. */
  showPreview?: boolean;
  /** Override the auto-detected required tier label. */
  requiredTier?: SubscriptionTier;
  /** Optional sub-copy under the feature title. */
  description?: string;
  /** Where to send the user on click. Defaults to /pricing. */
  onUpgradeClick?: () => void;
  /** Render nothing when the user has access — pass-through children only. */
  className?: string;
}

function inferRequiredTier(feature: FeatureKey): SubscriptionTier {
  const allowed = FEATURE_GATES[feature] as ReadonlyArray<SubscriptionTier>;
  if (allowed.includes("buyer")) return "buyer";
  if (allowed.includes("investor")) return "investor";
  return "investor";
}

/**
 * Wraps a feature so users without the required tier see a blurred preview
 * with an Upgrade overlay. Users with access see `children` untouched.
 *
 * Required tier is inferred from the FEATURE_GATES matrix.
 */
export function TierGate({
  feature,
  featureName,
  children,
  showPreview = true,
  requiredTier,
  description,
  onUpgradeClick,
  className,
}: TierGateProps) {
  const navigate = useNavigate();
  const { hasAccess, loading } = useSubscription();

  if (loading) {
    return <>{children}</>;
  }

  if (hasAccess(feature)) {
    return <>{children}</>;
  }

  const tier = requiredTier ?? inferRequiredTier(feature);
  const tierName = tier === "investor" ? "Investor" : "Buyer";

  const handleUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
      return;
    }
    navigate(`/pricing?target=${tier}`);
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      {showPreview && (
        <div className="pointer-events-none select-none opacity-40 blur-sm">
          {children}
        </div>
      )}
      <div
        className={`${
          showPreview ? "absolute inset-0" : ""
        } flex flex-col items-center justify-center p-6 bg-background/95 backdrop-blur-sm border border-border rounded-lg`}
      >
        <Lock className="h-8 w-8 text-muted-foreground mb-3" />
        <div className="flex items-center gap-2 mb-2 flex-wrap justify-center">
          <h3 className="font-semibold text-center">{featureName}</h3>
          <Badge variant="secondary">{tierName}</Badge>
        </div>
        <p className="text-sm text-muted-foreground text-center mb-4 max-w-xs">
          {description ?? `Upgrade to ${tierName} to unlock this feature.`}
        </p>
        <Button onClick={handleUpgrade} size="sm">
          Upgrade to {tierName}
        </Button>
      </div>
    </div>
  );
}