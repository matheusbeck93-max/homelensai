import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Crown, TrendingUp } from "lucide-react";
import {
  SUBSCRIPTION_PLANS,
  BUYER_ANNUAL_PLAN,
  INVESTOR_ANNUAL_PLAN,
  BillingPeriod,
  type SubscriptionPlan,
  type SubscriptionTier,
} from "@/lib/subscriptionPlans";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Pricing() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('free');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [searchParams] = useSearchParams();
  const capSessionId = searchParams.get('cap');
  const capSource = searchParams.get('source');

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
          const t = data.subscription_status;
          setCurrentTier((t === 'buyer' || t === 'investor') ? t : 'free');
        }
      }
    };
    loadSubscription();
  }, []);

  const handleUpgrade = async (priceId: string, planKey: string) => {
    setLoading(planKey);
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
        body: {
          priceId,
          ...(capSessionId ? { cap_session_id: capSessionId } : {}),
          ...(capSource ? { source: capSource } : {}),
        },
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
  const buyerPlan = billingPeriod === 'monthly' ? SUBSCRIPTION_PLANS.buyer : BUYER_ANNUAL_PLAN;
  const investorPlan = billingPeriod === 'monthly' ? SUBSCRIPTION_PLANS.investor : INVESTOR_ANNUAL_PLAN;

  const renderPaidCard = (
    plan: SubscriptionPlan,
    planKey: 'buyer' | 'investor',
    accent: 'primary' | 'secondary',
    mostPopular: boolean,
  ) => {
    const isCurrent = currentTier === planKey;
    return (
      <Card
        key={planKey}
        className={`relative flex flex-col ${accent === 'primary' ? 'border-primary shadow-lg' : 'border-border'}`}
      >
        {mostPopular && (
          <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" variant="default">
            Most Popular
          </Badge>
        )}
        {isCurrent && (
          <Badge className="absolute -top-3 right-4" variant="secondary">
            Your Plan
          </Badge>
        )}

        <CardHeader className="pb-2 pt-8">
          <div className="mb-4">
            {planKey === 'investor' ? (
              <TrendingUp className="h-10 w-10 text-primary" />
            ) : (
              <Crown className="h-10 w-10 text-primary" />
            )}
          </div>

          <h2 className="text-2xl font-bold">{plan.name}</h2>
          <p className="text-sm text-muted-foreground">{plan.subtitle}</p>

          <div className="mt-4">
            <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
            {plan.pricePeriod && (
              <span className="text-muted-foreground text-base ml-1">{plan.pricePeriod}</span>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-1">{plan.headerNote}</p>
        </CardHeader>

        <CardContent className="flex-1 pt-6">
          <Button
            className="w-full mb-6"
            variant="default"
            disabled={isCurrent || loading !== null}
            onClick={() => handleUpgrade(plan.stripePriceId || '', planKey)}
          >
            {isCurrent
              ? "Current Plan"
              : loading === planKey
                ? "Processing..."
                : plan.ctaLabel}
          </Button>

          <ul className="space-y-2.5">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-12 pb-24 md:pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold mb-3">Choose Your Plan</h1>
            <p className="text-muted-foreground text-lg">
              Start free. Upgrade when you need more.
            </p>
          </div>

          {/* Billing period toggle (applies to both paid tiers) */}
          <div className="flex justify-center mb-10">
            <div className="flex items-center gap-2 bg-muted rounded-lg p-1.5">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('annual')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  billingPeriod === 'annual'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Annual
                <span className="text-xs text-primary font-semibold">Save 20%</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {/* Free */}
            <Card className="relative flex flex-col border-border">
              {currentTier === 'free' && (
                <Badge className="absolute -top-3 right-4" variant="secondary">
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
                </div>
                <p className="text-xs text-muted-foreground mt-1">{freePlan.headerNote}</p>
              </CardHeader>
              <CardContent className="flex-1 pt-6">
                <Button
                  className="w-full mb-6"
                  variant="outline"
                  disabled={currentTier === 'free' || loading !== null}
                  onClick={() => navigate('/auth')}
                >
                  {currentTier === 'free' ? "Current Plan" : "Use HomeLens for free"}
                </Button>
                <ul className="space-y-2.5">
                  {freePlan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
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
                    <ul className="space-y-1.5">
                      {freePlan.limitations.map((limitation) => (
                        <li key={limitation} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <X className="h-4 w-4 shrink-0 mt-0.5 opacity-40" />
                          <span>{limitation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {renderPaidCard(buyerPlan, 'buyer', 'primary', true)}
            {renderPaidCard(investorPlan, 'investor', 'secondary', false)}
          </div>

          <div className="mt-12 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Paid plans can be cancelled anytime. No hidden fees.
            </p>
            <p className="text-sm text-muted-foreground">
              Need help?{" "}
              <a href="/chats" className="text-primary hover:underline">
                Chat with us
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}