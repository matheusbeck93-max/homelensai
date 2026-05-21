import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Crown } from "lucide-react";
import { SUBSCRIPTION_PLANS, PREMIUM_ANNUAL_PLAN, BillingPeriod } from "@/lib/subscriptionPlans";
import { motion } from "framer-motion";

export function PricingSection() {
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

  const freePlan = SUBSCRIPTION_PLANS.free;
  const premiumPlan = billingPeriod === 'monthly' ? SUBSCRIPTION_PLANS.premium : PREMIUM_ANNUAL_PLAN;

  return (
    <section className="py-16 px-4 bg-muted/30">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Start free, upgrade anytime. All plans include our core search and analysis features.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="grid md:grid-cols-2 gap-6">
            {/* Free Plan Card */}
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
                  {freePlan.pricePeriod && (
                    <span className="text-muted-foreground text-sm ml-1">{freePlan.pricePeriod}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{freePlan.headerNote}</p>
              </CardHeader>

              <CardContent className="flex-1 pt-4 space-y-4">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => navigate('/auth')}
                >
                  {freePlan.ctaLabel}
                </Button>

                <ul className="space-y-2">
                  {freePlan.features.slice(0, 6).map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                  {freePlan.features.length > 6 && (
                    <li className="text-xs text-primary">
                      + {freePlan.features.length - 6} more features
                    </li>
                  )}
                </ul>

                {freePlan.limitations && freePlan.limitations.length > 0 && (
                  <div className="pt-3 border-t">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-2">
                      Not included
                    </p>
                    <ul className="space-y-1.5">
                      {freePlan.limitations.slice(0, 3).map((limitation, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <X className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-40" />
                          <span>{limitation}</span>
                        </li>
                      ))}
                      {freePlan.limitations.length > 3 && (
                        <li className="text-xs text-muted-foreground">
                          + {freePlan.limitations.length - 3} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Premium Plan Card */}
            <Card className="relative flex flex-col border-primary shadow-lg bg-card">
              <Badge className="absolute -top-3 left-4" variant="default">
                Most Popular
              </Badge>

              <CardHeader className="pb-2 pt-8">
                <div className="mb-3">
                  <Crown className="h-9 w-9 text-primary" />
                </div>

                <h3 className="text-xl font-bold">{premiumPlan.name}</h3>
                <p className="text-xs text-muted-foreground">{premiumPlan.subtitle}</p>

                {/* Billing Period Toggle */}
                <div className="mt-3 mb-2">
                  <div className="flex items-center gap-2 bg-muted rounded-lg p-1 w-fit">
                    <button
                      onClick={() => setBillingPeriod('monthly')}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                        billingPeriod === 'monthly'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setBillingPeriod('annual')}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                        billingPeriod === 'annual'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Annual
                      <span className="text-[10px] text-primary font-semibold">Save 10%</span>
                    </button>
                  </div>
                </div>

                <div className="mt-1">
                  <span className="text-3xl font-bold tracking-tight">{premiumPlan.price}</span>
                  {premiumPlan.pricePeriod && (
                    <span className="text-muted-foreground text-sm ml-1">{premiumPlan.pricePeriod}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {billingPeriod === 'annual' ? 'Billed annually ($107.64/year)' : premiumPlan.headerNote}
                </p>
              </CardHeader>

              <CardContent className="flex-1 pt-4 space-y-4">
                <Button
                  className="w-full"
                  variant="default"
                  onClick={() => navigate('/pricing')}
                >
                  {premiumPlan.ctaLabel}
                </Button>

                <p className="text-xs text-muted-foreground">Everything in Free, plus:</p>

                <ul className="space-y-2">
                  {premiumPlan.features.slice(0, 8).map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                  {premiumPlan.features.length > 8 && (
                    <li className="text-xs text-primary">
                      + {premiumPlan.features.length - 8} more features
                    </li>
                  )}
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
