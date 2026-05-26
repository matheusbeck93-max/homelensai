import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Navigation } from '@/components/Navigation';
import { ConsoleSidebar } from '@/components/investor/console/ConsoleSidebar';
import { HomeLensInvestorCalculator } from '@/components/ui-blocks/HomeLensInvestorCalculator';

export default function InvestorCalculator() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

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
        <title>Investor Calculator — Cash Flow, ROI & IRR | HomeLens</title>
        <meta
          name="description"
          content="Professional real estate investor calculator. Run cash flow, cap rate, cash-on-cash, IRR, and tax-aware projections on any US rental property."
        />
        <link rel="canonical" href="https://homelensais.com/investor/calculator" />
      </Helmet>
      <Navigation />
      <div className="flex flex-row flex-1">
        <ConsoleSidebar />
        <main className="flex-1 min-w-0">
          <div className="container mx-auto px-4 py-6 lg:py-8 max-w-5xl">
            <header className="mb-6">
              <h1 className="text-3xl font-bold tracking-tight">Investor Calculator</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Professional-grade investment analysis for residential real estate.
              </p>
            </header>
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
          </div>
        </main>
      </div>
    </div>
  );
}
