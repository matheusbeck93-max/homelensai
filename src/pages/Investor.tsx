import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { HomeLensInvestorCalculator } from "@/components/ui-blocks/HomeLensInvestorCalculator";

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
      <Navigation />
      
      <div className="container mx-auto px-4 py-8 pt-24 pb-24 lg:pb-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Investor Calculator</h1>
          <p className="text-muted-foreground">
            Professional-grade investment analysis for residential real estate
          </p>
        </div>

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
    </div>
  );
}
