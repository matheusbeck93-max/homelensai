import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Crown } from "lucide-react";
import { SUBSCRIPTION_PLANS } from "@/lib/subscriptionPlans";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Pricing() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState<string>('free');

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

  const handleUpgrade = async () => {
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
        body: { priceId: 'price_1SXAIIDNPbNbmEcljT5VEjT8' },
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

  const plans = [SUBSCRIPTION_PLANS.free, SUBSCRIPTION_PLANS.premium];

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
            {plans.map((plan) => {
              const isCurrent = currentTier === plan.tier;
              const isUpgrade = currentTier === 'free' && plan.tier === 'premium';
              const isPremiumPlan = plan.tier === 'premium';

              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col ${isPremiumPlan ? 'border-primary shadow-lg' : 'border-border'}`}
                >
                  {isCurrent && (
                    <Badge className="absolute -top-3 left-4" variant="default">
                      Your Plan
                    </Badge>
                  )}

                  <CardHeader className="pb-2 pt-8">
                    {/* Icon placeholder */}
                    <div className="mb-4">
                      {isPremiumPlan ? (
                        <Crown className="h-10 w-10 text-primary" />
                      ) : (
                        <div className="h-10 w-10 rounded-full border-2 border-foreground/20 flex items-center justify-center">
                          <div className="h-3 w-3 rounded-full bg-foreground/20" />
                        </div>
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

                    {plan.headerNote && (
                      <p className="text-xs text-muted-foreground mt-1">{plan.headerNote}</p>
                    )}
                  </CardHeader>

                  <CardContent className="flex-1 pt-6">
                    {/* CTA Button */}
                    <Button
                      className="w-full mb-8"
                      variant={plan.ctaVariant}
                      disabled={isCurrent || loading !== null}
                      onClick={() => {
                        if (plan.tier === 'free') {
                          toast({
                            title: "You're on the Free plan",
                            description: "You're already using the free tier",
                          });
                        } else if (isUpgrade) {
                          handleUpgrade();
                        }
                      }}
                    >
                      {isCurrent
                        ? "Current Plan"
                        : loading === plan.tier
                          ? "Processing..."
                          : plan.ctaLabel}
                    </Button>

                    {/* Features header */}
                    {isPremiumPlan && (
                      <p className="text-sm text-muted-foreground mb-4">
                        Everything in Free, plus:
                      </p>
                    )}

                    {/* Feature list */}
                    <ul className="space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3 text-sm">
                          <Check className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Limitations (Free plan) */}
                    {plan.limitations && plan.limitations.length > 0 && (
                      <div className="mt-6 pt-4 border-t">
                        <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">
                          Not included
                        </p>
                        <ul className="space-y-2">
                          {plan.limitations.map((limitation) => (
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
              );
            })}
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
