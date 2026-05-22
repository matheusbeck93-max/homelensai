import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { SUBSCRIPTION_PLANS } from "@/lib/subscriptionPlans";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Crown, Sparkles, TrendingUp } from "lucide-react";
import { ManageSubscriptionButton } from "@/components/subscription/ManageSubscriptionButton";

export function SubscriptionPanel() {
  const navigate = useNavigate();
  const { tier } = useSubscription();

  const plans = [SUBSCRIPTION_PLANS.free, SUBSCRIPTION_PLANS.buyer, SUBSCRIPTION_PLANS.investor];

  return (
    <div className="space-y-8">
      {/* Plan Comparison */}
      <div>
        <h3 className="text-2xl font-bold mb-2">Your Subscription</h3>
        <p className="text-muted-foreground mb-6">
          Manage your HomeLens plan and billing.
        </p>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = plan.tier === tier;
            const isPaidPlan = plan.tier !== "free";
            const isUpgrade = !isCurrent && isPaidPlan && (
              tier === "free" ||
              (tier === "buyer" && plan.tier === "investor")
            );
            const isInvestorPlan = plan.tier === "investor";

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${
                  isCurrent
                    ? "border-primary shadow-lg"
                    : "border-border"
                }`}
              >
                {isCurrent && (
                  <Badge className="absolute -top-3 left-4" variant="default">
                    Your Plan
                  </Badge>
                )}

                <CardHeader className="pb-2 pt-8">
                  <div className="mb-3">
                    {!isPaidPlan ? (
                      <div className="h-9 w-9 rounded-full border-2 border-foreground/20 flex items-center justify-center">
                        <div className="h-2.5 w-2.5 rounded-full bg-foreground/20" />
                      </div>
                    ) : isInvestorPlan ? (
                      <TrendingUp className="h-9 w-9 text-primary" />
                    ) : (
                      <Crown className="h-9 w-9 text-primary" />
                    )}
                  </div>

                  <h2 className="text-xl font-bold">{plan.name}</h2>
                  <p className="text-xs text-muted-foreground">{plan.subtitle}</p>

                  <div className="mt-3">
                    <span className="text-3xl font-bold tracking-tight">{plan.price}</span>
                    {plan.pricePeriod && (
                      <span className="text-muted-foreground text-sm ml-1">{plan.pricePeriod}</span>
                    )}
                  </div>
                  {plan.headerNote && (
                    <p className="text-xs text-muted-foreground mt-1">{plan.headerNote}</p>
                  )}
                </CardHeader>

                <CardContent className="flex-1 pt-4 space-y-4">
                  {/* CTA */}
                  {isUpgrade && (
                    <Button className="w-full" onClick={() => navigate("/pricing")}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      {plan.ctaLabel}
                    </Button>
                  )}
                  {isCurrent && (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  )}

                  {/* Feature header for paid plans */}
                  {isPaidPlan && (
                    <p className="text-xs text-muted-foreground">Everything in Free, plus:</p>
                  )}

                  {/* Feature list */}
                  <ul className="space-y-2">
                    {plan.features.slice(0, 6).map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                    {plan.features.length > 6 && (
                      <li className="text-xs text-primary cursor-pointer" onClick={() => navigate("/pricing")}>
                        + {plan.features.length - 6} more features →
                      </li>
                    )}
                  </ul>

                  {/* Limitations (Free) */}
                  {plan.limitations && plan.limitations.length > 0 && (
                    <div className="pt-3 border-t">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-2">
                        Not included
                      </p>
                      <ul className="space-y-1.5">
                        {plan.limitations.slice(0, 3).map((l, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <X className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-40" />
                            <span>{l}</span>
                          </li>
                        ))}
                        {plan.limitations.length > 3 && (
                          <li className="text-xs text-muted-foreground">
                            + {plan.limitations.length - 3} more
                          </li>
                        )}
                      </ul>
                    </div>
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
            <h3 className="text-lg font-semibold">Billing Management</h3>
            <p className="text-sm text-muted-foreground">
              Update payment method, view invoices, or cancel subscription.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium text-sm">Manage Your Subscription</p>
                <p className="text-xs text-muted-foreground">
                  Access the billing portal to make changes.
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
