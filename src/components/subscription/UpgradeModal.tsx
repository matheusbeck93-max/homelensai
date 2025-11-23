import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
  feature?: string;
}

export function UpgradeModal({ isOpen, onClose, reason, feature }: UpgradeModalProps) {
  const navigate = useNavigate();

  const handleUpgradeToPro = () => {
    navigate('/pricing');
    onClose();
  };

  const handleSeeAllPlans = () => {
    navigate('/pricing');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <DialogTitle>Upgrade to HomeLens Pro</DialogTitle>
          </div>
          <DialogDescription>
            {reason || 'Unlock powerful features to supercharge your real estate search'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {feature && (
            <div className="p-3 bg-muted/50 rounded-lg border border-border">
              <p className="text-sm font-medium">You need Pro to access:</p>
              <p className="text-sm text-muted-foreground mt-1">{feature}</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              What you'll get with Pro:
            </p>
            <ul className="space-y-2">
              {[
                'Unlimited AI property analyses',
                'Price Fairness Meter',
                'AI-powered property comparison',
                'Export PDF reports',
                'Smart Alerts for favorites',
                'Investor calculators & tools',
                'Personalized weekly picks'
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
            <div>
              <p className="font-semibold text-sm">HomeLens Pro</p>
              <p className="text-xs text-muted-foreground">Cancel anytime</p>
            </div>
            <Badge variant="secondary" className="text-base font-bold">
              $4.99/mo
            </Badge>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={handleUpgradeToPro} className="w-full">
            Upgrade to Pro
          </Button>
          <Button onClick={handleSeeAllPlans} variant="outline" className="w-full">
            See All Plans
          </Button>
          <Button onClick={onClose} variant="ghost" className="w-full">
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
