import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, TrendingUp } from "lucide-react";
import {
  SUBSCRIPTION_PLANS,
  BUYER_ANNUAL_PLAN,
  INVESTOR_ANNUAL_PLAN,
  BillingPeriod,
} from "@/lib/subscriptionPlans";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

export function PricingSection() {
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const freePlan = SUBSCRIPTION_PLANS.free;
  const buyerPlan = billingPeriod === 'monthly' ? SUBSCRIPTION_PLANS.buyer : BUYER_ANNUAL_PLAN;
  const investorPlan = billingPeriod === 'monthly' ? SUBSCRIPTION_PLANS.investor : INVESTOR_ANNUAL_PLAN;

  const freeLabel = isLoggedIn ? freePlan.ctaLabel : 'Get started free';
  const buyerLabel = isLoggedIn ? buyerPlan.ctaLabel : 'Subscribe to Buyer';
  const investorLabel = isLoggedIn ? investorPlan.ctaLabel : 'Subscribe to Investor';

  const goToPaid = (tier: 'buyer' | 'investor') => {
    if (isLoggedIn) navigate('/pricing');
    else navigate(`/auth?redirect=/pricing&plan=${tier}`);
  };

  return (
    <section className="py-16 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Start free. Pick Buyer for full home-buying tools, or Investor for rental-property analysis.
            </p>
          </div>

          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-2 bg-background rounded-lg p-1 border">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-muted text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod('annual')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                  billingPeriod === 'annual'
                    ? 'bg-muted text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Annual
                <span className="text-[10px] text-primary font-semibold">Save 20%</span>
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="grid md:grid-cols-3 gap-6">
            {/* Free */}
            <Card className="relative flex flex-col border-border bg-card">
              <CardHeader className="pb-2 pt-8">
                <div className="mb-3">
                  <div className="h-9 w-9 rounded-full border-2 border-foreground/20 flex items-center justify-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-foreground/20" />
                  </div>
                </div>
                <h3 className="text-xl font-bold">{freePlan.name}</h3>
                <p className="text-xs text-muted-foreground">{freePlan.subtitle}</p>
                <div className="mt-3">
                  <span className="text-3xl font-bold tracking-tight">{freePlan.price}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{freePlan.headerNote}</p>
              </CardHeader>
              <CardContent className="flex-1 pt-4 space-y-4">
                <Button className="w-full" variant="outline" onClick={() => navigate('/auth')}>
                  {freeLabel}
                </Button>
                <ul className="space-y-2">
                  {freePlan.features.slice(0, 6).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Buyer - Most Popular */}
            <Card className="relative flex flex-col border-primary shadow-lg bg-card">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" variant="default">
                Most Popular
              </Badge>
              <CardHeader className="pb-2 pt-8">
                <div className="mb-3">
                  <Crown className="h-9 w-9 text-primary" />
                </div>
                <h3 className="text-xl font-bold">{buyerPlan.name}</h3>
                <p className="text-xs text-muted-foreground">{buyerPlan.subtitle}</p>
                <div className="mt-3">
                  <span className="text-3xl font-bold tracking-tight">{buyerPlan.price}</span>
                  {buyerPlan.pricePeriod && (
                    <span className="text-muted-foreground text-sm ml-1">{buyerPlan.pricePeriod}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{buyerPlan.headerNote}</p>
              </CardHeader>
              <CardContent className="flex-1 pt-4 space-y-4">
                <Button className="w-full" variant="default" onClick={() => goToPaid('buyer')}>
                  {buyerLabel}
                </Button>
                <ul className="space-y-2">
                  {buyerPlan.features.slice(0, 8).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Investor */}
            <Card className="relative flex flex-col border-border bg-card">
              <CardHeader className="pb-2 pt-8">
                <div className="mb-3">
                  <TrendingUp className="h-9 w-9 text-primary" />
                </div>
                <h3 className="text-xl font-bold">{investorPlan.name}</h3>
                <p className="text-xs text-muted-foreground">{investorPlan.subtitle}</p>
                <div className="mt-3">
                  <span className="text-3xl font-bold tracking-tight">{investorPlan.price}</span>
                  {investorPlan.pricePeriod && (
                    <span className="text-muted-foreground text-sm ml-1">{investorPlan.pricePeriod}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{investorPlan.headerNote}</p>
              </CardHeader>
              <CardContent className="flex-1 pt-4 space-y-4">
                <Button className="w-full" variant="default" onClick={() => goToPaid('investor')}>
                  {investorLabel}
                </Button>
                <ul className="space-y-2">
                  {investorPlan.features.slice(0, 8).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="mt-10 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Cancel anytime. No hidden fees.
            </p>
            <Button variant="link" size="sm" onClick={() => navigate('/pricing')}>
              View full plan details →
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}