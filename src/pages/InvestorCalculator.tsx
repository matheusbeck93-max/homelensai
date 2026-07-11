import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Navigation } from '@/components/Navigation';
import { ConsoleSidebar } from '@/components/investor/console/ConsoleSidebar';
import { HomeLensInvestorCalculator } from '@/components/ui-blocks/HomeLensInvestorCalculator';
import { TierGate } from '@/components/subscription/TierGate';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BrrrrCalculatorPanel } from '@/pages/CalculatorBrrrr';

export default function InvestorCalculator() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam === 'brrrr' ? 'brrrr' : 'rental';
  const handleTabChange = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', v);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/auth?redirect=/investor/calculator');
        return;
      }
      setReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate('/auth?redirect=/investor/calculator');
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Investor Calculators — Cash Flow, IRR & BRRRR | HomeLens</title>
        <meta
          name="description"
          content="Professional real estate investor calculators: cash flow, cap rate, cash-on-cash, IRR, tax-aware projections, and full BRRRR cash-on-cash after refinance."
        />
        <link rel="canonical" href="https://homelensais.com/investor/calculator" />
      </Helmet>
      <Navigation />
      <div className="flex flex-row flex-1">
        <ConsoleSidebar />
        <main className="flex-1 min-w-0">
          <div className="container mx-auto px-4 py-6 lg:py-8 max-w-5xl">
            <header className="mb-6">
              <h1 className="text-4xl font-bold mb-2">Investor Calculators</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Professional-grade investment analysis for residential real estate — pick a tab.
              </p>
            </header>
            <TierGate
              feature="INVESTOR_CALCULATOR"
              featureName="Investor Calculators"
              description="Cash flow, cap rate, IRR, stress scenarios, tax modeling and BRRRR — included with the Investor plan."
            >
              <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-flex">
                  <TabsTrigger value="rental">Rental (Cash Flow / IRR)</TabsTrigger>
                  <TabsTrigger value="brrrr">BRRRR</TabsTrigger>
                </TabsList>
                <TabsContent value="rental" className="mt-0">
                  <HomeLensInvestorCalculator
                    title="HomeLens Investor Calculator"
                    inputs={{
                      price: 0,
                      downPct: 20,
                      ratePct: 7.0,
                      years: 30,
                      rentMonthly: 0,
                      vacancyPct: 5,
                      taxPct: 1.0,
                      insuranceAnnual: 1200,
                      repairsPct: 5,
                      capexPct: 7,
                      managementPct: 10,
                      hoaMonthly: 0,
                      closingCosts: 0,
                    }}
                  />
                </TabsContent>
                <TabsContent value="brrrr" className="mt-0">
                  <BrrrrCalculatorPanel showHeading />
                </TabsContent>
              </Tabs>
            </TierGate>
          </div>
        </main>
      </div>
    </div>
  );
}
