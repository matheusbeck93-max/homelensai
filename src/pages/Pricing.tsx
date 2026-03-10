import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navigation } from "@/components/Navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { SUBSCRIPTION_PLANS } from "@/lib/subscriptionPlans";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Pricing() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState<string>('free');

  // Load user's current subscription
  useState(() => {
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
  });

  const handleUpgrade = async (tier: 'pro' | 'premium') => {
    setLoading(tier);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to upgrade your plan",
        variant: "destructive"
      });
      setLoading(null);
      navigate('/auth');
      return;
    }

    try {
      const priceId = tier === 'pro' 
        ? 'price_1SXAGhDNPbNbmEcl7swPot9W' 
        : 'price_1SXAIIDNPbNbmEcljT5VEjT8';

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId }
      });

      if (error) throw error;

      if (data?.url) {
        // Open Stripe checkout in new tab
        window.open(data.url, '_blank');
        toast({
          title: "Redirecting to checkout",
          description: "Complete your payment in the new tab"
        });
      }
    } catch (error: any) {
      toast({
        title: "Checkout failed",
        description: error.message || "Failed to start checkout process",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  const plans = [
    SUBSCRIPTION_PLANS.free,
    SUBSCRIPTION_PLANS.pro,
    SUBSCRIPTION_PLANS.premium
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
            <p className="text-muted-foreground text-lg">
              Start free, upgrade anytime. All plans include our core search features.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isCurrent = currentTier === plan.tier;
              const isUpgrade = 
                (currentTier === 'free' && (plan.tier === 'pro' || plan.tier === 'premium')) ||
                (currentTier === 'pro' && plan.tier === 'premium');
              
              return (
                <Card 
                  key={plan.id} 
                  className={`relative ${plan.tier === 'pro' ? 'border-primary shadow-lg' : ''}`}
                >
                  {plan.tier === 'pro' && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                      Most Popular
                    </Badge>
                  )}
                  
                  <CardHeader>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription>
                      <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                      {plan.tier !== 'free' && (
                        <span className="text-muted-foreground"> /month</span>
                      )}
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    <ul className="space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {plan.limitations && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Limitations:</p>
                        <ul className="space-y-1">
                          {plan.limitations.map((limitation) => (
                            <li key={limitation} className="text-xs text-muted-foreground">
                              • {limitation}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter>
                    <Button
                      className="w-full"
                      variant={isCurrent ? "outline" : plan.tier === 'pro' ? "default" : "outline"}
                      disabled={isCurrent || loading !== null}
                      onClick={() => {
                        if (plan.tier === 'free') {
                          toast({
                            title: "Already on Free plan",
                            description: "You're currently using the free tier"
                          });
                        } else if (isUpgrade) {
                          handleUpgrade(plan.tier as 'pro' | 'premium');
                        }
                      }}
                    >
                      {isCurrent 
                        ? "Current Plan" 
                        : loading === plan.tier 
                          ? "Processing..." 
                          : isUpgrade 
                            ? `Upgrade to ${plan.name}`
                            : "Get Started"
                      }
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">
              All paid plans can be cancelled anytime. No hidden fees.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Need help choosing? <a href="/chat" className="text-primary hover:underline">Chat with us</a>
            </p>
          </div>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
