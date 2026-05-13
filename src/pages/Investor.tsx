import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { HomeLensInvestorCalculator } from "@/components/ui-blocks/HomeLensInvestorCalculator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator as CalculatorIcon, Bookmark } from "lucide-react";
import { SavedAnalysesContent } from "@/pages/SavedAnalyses";

export default function Investor() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth?redirect=/investor");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth?redirect=/investor");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Investor Calculator — Cash Flow, ROI & IRR | HomeLens</title>
        <meta name="description" content="Professional real estate investor calculator. Run cash flow, cap rate, cash-on-cash, IRR, and tax-aware projections on any US rental property." />
        <link rel="canonical" href="https://homelensais.com/investor" />
        <meta property="og:title" content="Investor Calculator — Cash Flow, ROI & IRR | HomeLens" />
        <meta property="og:description" content="Run cash flow, cap rate, cash-on-cash, IRR, and tax-aware projections on any US rental property." />
        <meta property="og:url" content="https://homelensais.com/investor" />
        <meta property="og:type" content="website" />
        <meta name="twitter:title" content="Investor Calculator — Cash Flow, ROI & IRR | HomeLens" />
        <meta name="twitter:description" content="Run cash flow, cap rate, cash-on-cash, IRR, and tax-aware projections on any US rental property." />
      </Helmet>
      <Navigation />
      
      <div className="container mx-auto px-4 py-8 pt-24 pb-24 lg:pb-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Investor Calculator</h1>
          <p className="text-muted-foreground">
            Professional-grade investment analysis for residential real estate
          </p>
        </div>

        <Tabs defaultValue="calculator" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="calculator" className="gap-2">
              <CalculatorIcon className="h-4 w-4" />
              Calculator
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-2">
              <Bookmark className="h-4 w-4" />
              Saved Analyses
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calculator">
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

          <TabsContent value="saved">
            <SavedAnalysesContent showHeader={false} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
