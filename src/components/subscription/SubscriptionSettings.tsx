import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Crown, ArrowUpRight } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { SUBSCRIPTION_PLANS } from "@/lib/subscriptionPlans";

export function SubscriptionSettings() {
  const navigate = useNavigate();
  const { tier, loading } = useSubscription();
  const [canceling, setCanceling] = useState(false);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>Loading subscription details...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const currentPlan = SUBSCRIPTION_PLANS[tier];
  const isPremium = tier === 'premium';
  const isPro = tier === 'pro';
  const isFree = tier === 'free';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Subscription
          {isPremium && <Crown className="h-5 w-5 text-amber-600" />}
          {isPro && <Sparkles className="h-5 w-5 text-primary" />}
        </CardTitle>
        <CardDescription>Manage your HomeLens subscription</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold">{currentPlan.name} Plan</h3>
              <Badge variant="secondary">
                {currentPlan.price}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {isFree && "Your current plan"}
              {isPro && "Professional features unlocked"}
              {isPremium && "All features unlocked"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Features included:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            {currentPlan.features.slice(0, 5).map((feature) => (
              <li key={feature}>• {feature}</li>
            ))}
            {currentPlan.features.length > 5 && (
              <li className="text-primary">+ {currentPlan.features.length - 5} more features</li>
            )}
          </ul>
        </div>

        <div className="flex flex-col gap-2 pt-4">
          {isFree && (
            <Button onClick={() => navigate('/pricing')} className="w-full">
              <ArrowUpRight className="h-4 w-4 mr-2" />
              Upgrade to Pro
            </Button>
          )}

          {isPro && (
            <>
              <Button onClick={() => navigate('/pricing')} className="w-full">
                <Crown className="h-4 w-4 mr-2" />
                Upgrade to Premium
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/pricing')} 
                className="w-full"
              >
                View All Plans
              </Button>
            </>
          )}

          {isPremium && (
            <Button 
              variant="outline" 
              onClick={() => navigate('/pricing')} 
              className="w-full"
            >
              View All Plans
            </Button>
          )}

          {!isFree && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={canceling}
              onClick={() => {
                // TODO: Implement cancellation flow
                setCanceling(true);
                setTimeout(() => {
                  alert('Cancellation flow will be implemented with billing integration');
                  setCanceling(false);
                }, 1000);
              }}
            >
              {canceling ? "Processing..." : "Cancel Subscription"}
            </Button>
          )}
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Questions about billing? <a href="/chat" className="text-primary hover:underline">Contact support</a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
