import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { SUBSCRIPTION_PLANS } from "@/lib/subscriptionPlans";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Crown } from "lucide-react";
import { ManageSubscriptionButton } from "@/components/subscription/ManageSubscriptionButton";

export function SubscriptionPanel() {
  const navigate = useNavigate();
  const { tier } = useSubscription();

  const currentPlan = SUBSCRIPTION_PLANS[tier];

  return (
    <div className="space-y-8">
      {/* Current Plan */}
      <Card className="border-primary">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                Your Current Plan
                <Badge variant="default" className="capitalize">
                  {tier}
                </Badge>
              </CardTitle>
              <CardDescription className="text-lg mt-2">
                {currentPlan.price}
              </CardDescription>
            </div>
            {tier !== "free" && (
              <div className="text-4xl">
                {tier === "premium" ? <Crown className="h-12 w-12 text-yellow-500" /> : <Sparkles className="h-12 w-12 text-primary" />}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {currentPlan.features.map((feature, index) => (
              <div key={index} className="flex items-start gap-2">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{feature}</span>
              </div>
            ))}
          </div>
          {currentPlan.limitations && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium text-muted-foreground mb-2">Limitations:</p>
              <div className="space-y-1">
                {currentPlan.limitations.map((limitation, index) => (
                  <p key={index} className="text-sm text-muted-foreground">
                    • {limitation}
                  </p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <div>
        <h3 className="text-2xl font-bold mb-6">Compare Plans</h3>
        <div className="grid md:grid-cols-3 gap-6">
          {Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => {
            const isCurrent = key === tier;
            const canUpgrade = 
              (tier === "free" && key !== "free") ||
              (tier === "pro" && key === "premium");
            
            return (
              <Card 
                key={key} 
                className={isCurrent ? "border-primary shadow-lg" : ""}
              >
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="capitalize">{plan.name}</CardTitle>
                    {isCurrent && (
                      <Badge variant="default">Current</Badge>
                    )}
                  </div>
                  <CardDescription className="text-2xl font-bold text-foreground">
                    {plan.price}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {plan.features.slice(0, 6).map((feature, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                  {canUpgrade && (
                    <Button 
                      className="w-full" 
                      onClick={() => navigate("/pricing")}
                    >
                      Upgrade to {plan.name}
                    </Button>
                  )}
                  {isCurrent && key !== "free" && (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Billing Management */}
      {tier !== "free" && (
        <Card>
          <CardHeader>
            <CardTitle>Billing Management</CardTitle>
            <CardDescription>
              Manage your subscription and billing settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Manage Your Subscription</p>
                <p className="text-sm text-muted-foreground">
                  Update payment method, view invoices, or cancel subscription
                </p>
              </div>
              <ManageSubscriptionButton />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
