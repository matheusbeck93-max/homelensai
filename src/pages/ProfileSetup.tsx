import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Home, Check, Crown, TrendingUp } from "lucide-react";
import { PreferencesChat } from "@/components/console/PreferencesChat";
import { Navigation } from "@/components/Navigation";
import { ConsoleSidebar } from "@/components/investor/console/ConsoleSidebar";
import { PersonaPicker } from "@/components/preferences/PersonaPicker";
import { PERSONAS, type PersonaId, getPersona } from "@/lib/personas/personaRegistry";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  SUBSCRIPTION_PLANS,
  BUYER_ANNUAL_PLAN,
  INVESTOR_ANNUAL_PLAN,
  BillingPeriod,
} from "@/lib/subscriptionPlans";

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState<'prefs' | 'persona' | 'plan'>('prefs');
  const [savingPersona, setSavingPersona] = useState(false);
  const [initialPersona, setInitialPersona] = useState<PersonaId | null>(null);
  const [initialSecondary, setInitialSecondary] = useState<PersonaId[]>([]);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from('profiles')
        .select('persona, persona_secondary')
        .eq('id', user.id)
        .maybeSingle();
      if (data?.persona) setInitialPersona(data.persona as PersonaId);
      if (data?.persona_secondary) setInitialSecondary(data.persona_secondary as PersonaId[]);
    });
  }, []);

  const advanceToPersona = () => {
    setStep('persona');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const advanceToPlan = () => {
    setStep('plan');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSavePersona = async (primary: PersonaId, secondary: PersonaId[]) => {
    if (!userId) { navigate('/auth'); return; }
    setSavingPersona(true);
    try {
      const def = getPersona(primary);
      const updates: Record<string, unknown> = {
        persona: primary,
        persona_secondary: secondary,
        persona_set_at: new Date().toISOString(),
        onboarding_completed: true,
      };
      // Pre-fill persona defaults if the user hasn't set them.
      if (def.preferenceDefaults?.risk_level) {
        updates.risk_level = def.preferenceDefaults.risk_level;
      }
      const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
      if (error) throw error;
      await supabase.from('investor_persona_telemetry').insert({
        user_id: userId,
        persona: primary,
        event_type: initialPersona === primary ? 'investor_persona_changed' : 'investor_persona_set',
        payload: { from: initialPersona ?? 'mixed', to: primary, secondary, source: 'onboarding' } as never,
      });
      toast({ title: 'Investor focus saved', description: 'One last step — pick your plan.' });
      advanceToPlan();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSavingPersona(false);
    }
  };

  const handleSaveAndContinue = async () => {
    advanceToPersona();
  };

  const handleSkip = async () => {
    advanceToPersona();
  };

  const handlePickFree = async () => {
    if (!userId) { navigate('/auth'); return; }
    setCheckoutLoading('free');
    try {
      await supabase
        .from('profiles')
        .update({ subscription_status: 'free' })
        .eq('id', userId);
      toast({ title: 'You\u2019re all set on Free', description: 'You can upgrade anytime from Pricing.' });
      navigate('/investor');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePickPaid = async (tier: 'buyer' | 'investor', priceId: string) => {
    setCheckoutLoading(tier);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
        toast({
          title: 'Redirecting to checkout',
          description: 'Complete your payment in the new tab \u2014 your plan will activate automatically.',
        });
      }
    } catch (e: any) {
      toast({ title: 'Checkout failed', description: e.message ?? 'Try again.', variant: 'destructive' });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const renderPlanStep = () => {
    const freePlan = SUBSCRIPTION_PLANS.free;
    const buyerPlan = billingPeriod === 'monthly' ? SUBSCRIPTION_PLANS.buyer : BUYER_ANNUAL_PLAN;
    const investorPlan = billingPeriod === 'monthly' ? SUBSCRIPTION_PLANS.investor : INVESTOR_ANNUAL_PLAN;
    return (
      <div>
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2 bg-background rounded-lg p-1 border">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                billingPeriod === 'monthly' ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >Monthly</button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                billingPeriod === 'annual' ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >Annual<span className="text-[10px] text-primary font-semibold">Save 20%</span></button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {/* Free */}
          <Card className="relative flex flex-col border-border bg-card">
            <CardHeader className="pb-2 pt-6">
              <div className="mb-2">
                <div className="h-8 w-8 rounded-full border-2 border-foreground/20 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-foreground/20" />
                </div>
              </div>
              <h3 className="text-lg font-bold">{freePlan.name}</h3>
              <p className="text-xs text-muted-foreground">{freePlan.subtitle}</p>
              <div className="mt-2"><span className="text-2xl font-bold tracking-tight">{freePlan.price}</span></div>
              <p className="text-xs text-muted-foreground mt-1">{freePlan.headerNote}</p>
            </CardHeader>
            <CardContent className="flex-1 pt-3 space-y-3">
              <Button className="w-full" variant="outline" disabled={checkoutLoading !== null} onClick={handlePickFree}>
                {checkoutLoading === 'free' ? 'Saving\u2026' : 'Continue with Free'}
              </Button>
              <ul className="space-y-1.5">
                {freePlan.features.slice(0, 5).map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Buyer */}
          <Card className="relative flex flex-col border-primary shadow-lg bg-card">
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2" variant="default">Most Popular</Badge>
            <CardHeader className="pb-2 pt-6">
              <div className="mb-2"><Crown className="h-8 w-8 text-primary" /></div>
              <h3 className="text-lg font-bold">{buyerPlan.name}</h3>
              <p className="text-xs text-muted-foreground">{buyerPlan.subtitle}</p>
              <div className="mt-2">
                <span className="text-2xl font-bold tracking-tight">{buyerPlan.price}</span>
                {buyerPlan.pricePeriod && <span className="text-muted-foreground text-sm ml-1">{buyerPlan.pricePeriod}</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{buyerPlan.headerNote}</p>
            </CardHeader>
            <CardContent className="flex-1 pt-3 space-y-3">
              <Button
                className="w-full"
                variant="default"
                disabled={checkoutLoading !== null}
                onClick={() => handlePickPaid('buyer', buyerPlan.stripePriceId!)}
              >
                {checkoutLoading === 'buyer' ? 'Opening checkout\u2026' : 'Subscribe to Buyer'}
              </Button>
              <ul className="space-y-1.5">
                {buyerPlan.features.slice(0, 6).map((f, i) => (
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
            <CardHeader className="pb-2 pt-6">
              <div className="mb-2"><TrendingUp className="h-8 w-8 text-primary" /></div>
              <h3 className="text-lg font-bold">{investorPlan.name}</h3>
              <p className="text-xs text-muted-foreground">{investorPlan.subtitle}</p>
              <div className="mt-2">
                <span className="text-2xl font-bold tracking-tight">{investorPlan.price}</span>
                {investorPlan.pricePeriod && <span className="text-muted-foreground text-sm ml-1">{investorPlan.pricePeriod}</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{investorPlan.headerNote}</p>
            </CardHeader>
            <CardContent className="flex-1 pt-3 space-y-3">
              <Button
                className="w-full"
                variant="default"
                disabled={checkoutLoading !== null}
                onClick={() => handlePickPaid('investor', investorPlan.stripePriceId!)}
              >
                {checkoutLoading === 'investor' ? 'Opening checkout\u2026' : 'Subscribe to Investor'}
              </Button>
              <ul className="space-y-1.5">
                {investorPlan.features.slice(0, 6).map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          AI chat personalization (your saved preferences) activates on Buyer and Investor plans.
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navigation />
      <div className="flex flex-row flex-1">
        <ConsoleSidebar />
        <main className="flex-1 min-w-0">
          <div className="container mx-auto px-4 py-6 lg:py-8 max-w-5xl">
            {/* Header */}
            <div className="text-center mb-10">
          <div className="flex items-center justify-center mb-4">
            <Home className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {step === 'prefs'
              ? 'Set Up Your Profile'
              : step === 'persona'
              ? 'Pick your investor focus'
              : 'Choose your plan'}
          </h1>
          <p className="text-lg text-muted-foreground">
            {step === 'prefs'
              ? 'Have a personalized experience with HomeLens.'
              : step === 'persona'
              ? 'We use this to tune your Brief, calculator defaults, and AI tool selection.'
              : 'Pick the plan that fits how you\u2019ll use HomeLens.'}
          </p>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className={step === 'prefs' ? 'text-primary font-medium' : ''}>1. Preferences</span>
            <span>·</span>
            <span className={step === 'persona' ? 'text-primary font-medium' : ''}>2. Investor focus</span>
            <span>·</span>
            <span className={step === 'plan' ? 'text-primary font-medium' : ''}>3. Plan</span>
          </div>
        </div>

        {step === 'prefs' ? (
          <PreferencesChat
            onSaveComplete={handleSaveAndContinue}
            continueLabel="Continue to investor focus"
            onSkip={handleSkip}
          />
        ) : step === 'persona' ? (
          <Card className="p-6">
            <PersonaPicker
              value={initialPersona ?? undefined}
              secondary={initialSecondary}
              onChange={handleSavePersona}
              saving={savingPersona}
            />
          </Card>
        ) : (
          renderPlanStep()
        )}
          </div>
        </main>
      </div>
    </div>
  );
}
