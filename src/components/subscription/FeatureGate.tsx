import { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SubscriptionTier } from "@/lib/subscriptionPlans";

interface FeatureGateProps {
  isLocked: boolean;
  requiredTier?: SubscriptionTier;
  featureName: string;
  onUpgradeClick: () => void;
  children: ReactNode;
  showPreview?: boolean;
}

export function FeatureGate({ 
  isLocked, 
  requiredTier = 'buyer',
  featureName, 
  onUpgradeClick, 
  children,
  showPreview = true
}: FeatureGateProps) {
  if (!isLocked) {
    return <>{children}</>;
  }

  const tierName = requiredTier === 'investor' ? 'Investor' : 'Buyer';

  return (
    <div className="relative">
      {showPreview && (
        <div className="pointer-events-none opacity-40 blur-sm">
          {children}
        </div>
      )}
      <div className={`${showPreview ? 'absolute inset-0' : ''} flex flex-col items-center justify-center p-6 bg-background/95 backdrop-blur-sm border border-border rounded-lg`}>
        <Lock className="h-8 w-8 text-muted-foreground mb-3" />
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-semibold text-center">{featureName}</h3>
          <Badge variant="secondary">{tierName}</Badge>
        </div>
        <p className="text-sm text-muted-foreground text-center mb-4 max-w-xs">
          Upgrade to {tierName} to unlock this feature
        </p>
        <Button onClick={onUpgradeClick} size="sm">
          Upgrade to {tierName}
        </Button>
      </div>
    </div>
  );
}
