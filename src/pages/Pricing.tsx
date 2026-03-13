import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Check, X, Crown } from "lucide-react";
import { SUBSCRIPTION_PLANS, PREMIUM_ANNUAL_PLAN, BillingPeriod } from "@/lib/subscriptionPlans";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Pricing() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState<string>('free');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

  useEffect(() => {
    const loadSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('subscription_status')
          .eq('id', user.id)
          .maybeSingle();
        if (data) {
          setCurrentTier(data.subscription_status || 'free');
        }
      }
    };
    loadSubscription();
  }, []);

  const handleUpgrade = async (priceId: string) => {
    setLoading('premium');
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to upgrade your plan",
        variant: "destructive",
      });
      setLoading(null);
      navigate('/auth');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
        toast({
          title: "Redirecting to checkout",
          description: "Complete your payment in the new tab",
        });
      }
    } catch (error: any) {
      toast({
        title: "Checkout failed",
        description: error.message || "Failed to start checkout process",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const freePlan = SUBSCRIPTION_PLANS.free;
  const premiumPlan = billingPeriod === 'monthly' ? SUBSCRIPTION_PLANS.premium : PREMIUM_ANNUAL_PLAN;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-12 pb-24 md:pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-3">Choose Your Plan</h1>
            <p className="text-muted-foreground text-lg">
              Start free, upgrade anytime. All plans include our core search features.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Free Plan Card */}
            <Card className="relative flex flex-col border-border">
              {currentTier === 'free' && (
                <Badge className="absolute -top-3 left-4" variant="default">
                  Your Plan
                </Badge>
              )}

              <CardHeader className="pb-2 pt-8">
                <div className="mb-4">
                  <div className="h-10 w-10 rounded-full border-2 border-foreground/20 flex items-center justify-center">
                    <div className="h-3 w-3 rounded-full bg-foreground/20" />
                  </div>
                </div>

                <h2 className="text-2xl font-bold">{freePlan.name}</h2>
                <p className="text-sm text-muted-foreground">{freePlan.subtitle}</p>

                <div className="mt-4">
                  <span className="text-4xl font-bold tracking-tight">{freePlan.price}</span>
                  {freePlan.pricePeriod && (
                    <span className="text-muted-foreground text-base ml-1">{freePlan.pricePeriod}</span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-1">{freePlan.headerNote}</p>
              </CardHeader>

              <CardContent className="flex-1 pt-6">
                <Button
                  className="w-full mb-8"
                  variant={freePlan.ctaVariant}
                  disabled={currentTier === 'free' || loading !== null}
                  onClick={() => {
                    toast({
                      title: "You're on the Free plan",
                      description: "You're already using the free tier",
                    });
                  }}
                >
                  {currentTier === 'free' ? "Current Plan" : "Use HomeLens for free"}
                </Button>

                <ul className="space-y-3">
                  {freePlan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm">
                      <Check className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {freePlan.limitations && freePlan.limitations.length > 0 && (
                  <div className="mt-6 pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">
                      Not included
                    </p>
                    <ul className="space-y-2">
                      {freePlan.limitations.map((limitation) => (
                        <li key={limitation} className="flex items-start gap-3 text-sm text-muted-foreground">
                          <X className="h-4 w-4 shrink-0 mt-0.5 opacity-40" />
                          <span>{limitation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Premium Plan Card */}
            <Card className="relative flex flex-col border-primary shadow-lg">
              {currentTier === 'premium' && (
                <Badge className="absolute -top-3 left-4" variant="default">
                  Your Plan
                </Badge>
              )}

              <CardHeader className="pb-2 pt-8">
                <div className="mb-4">
                  <Crown className="h-10 w-10 text-primary" />
                </div>

                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-2xl font-bold">{premiumPlan.name}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{premiumPlan.subtitle}</p>

                {/* Billing Period Toggle */}
                <div className="mt-4 mb-4">
                  <div className="flex items-center gap-3 bg-muted rounded-lg p-1.5 w-fit">
                    <button
                      onClick={() => setBillingPeriod('monthly')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        billingPeriod === 'monthly'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setBillingPeriod('annual')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                        billingPeriod === 'annual'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Annual
                      <span className="text-xs text-primary font-semibold">Save 10%</span>
                    </button>
                  </div>
                </div>

                <div className="mt-2">
                  <span className="text-4xl font-bold tracking-tight">{premiumPlan.price}</span>
                  {premiumPlan.pricePeriod && (
                    <span className="text-muted-foreground text-base ml-1">{premiumPlan.pricePeriod}</span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-1">
                  {billingPeriod === 'annual' ? 'Billed annually ($53.70/year)' : premiumPlan.headerNote}
                </p>
              </CardHeader>

              <CardContent className="flex-1 pt-6">
                <Button
                  className="w-full mb-8"
                  variant={premiumPlan.ctaVariant}
                  disabled={currentTier === 'premium' || loading !== null}
                  onClick={() => handleUpgrade(premiumPlan.stripePriceId || '')}
                >
                  {currentTier === 'premium'
                    ? "Current Plan"
                    : loading === 'premium'
                      ? "Processing..."
                      : premiumPlan.ctaLabel}
                </Button>

                <p className="text-sm text-muted-foreground mb-4">
                  Everything in Free, plus:
                </p>

                <ul className="space-y-3">
                  {premiumPlan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm">
                      <Check className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Paid plan can be cancelled anytime. No hidden fees.
            </p>
            <p className="text-sm text-muted-foreground">
              Need help?{" "}
              <a href="/chat" className="text-primary hover:underline">
                Chat with us
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}