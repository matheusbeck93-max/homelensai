import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Lock, Plus, Sparkles } from "lucide-react";
import { PortfolioOverview } from "@/components/portfolio/PortfolioOverview";
import { PortfolioPropertyCard } from "@/components/portfolio/PortfolioPropertyCard";
import { useToast } from "@/hooks/use-toast";
import type { PortfolioProperty } from "@/pages/Portfolio";

export function InvestorPortfolioPanel() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tier, hasAccess, loading: subscriptionLoading } = useSubscription();
  const hasPortfolioAccess = hasAccess('PORTFOLIO_TRACKING');
  const [portfolio, setPortfolio] = useState<PortfolioProperty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hasPortfolioAccess) {
      loadPortfolio();
    } else {
      setLoading(false);
    }
  }, [hasPortfolioAccess]);

  const loadPortfolio = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data, error } = await supabase
        .from('portfolio_properties')
        .select(`
          *,
          property:properties (
            id,
            address,
            city,
            state,
            zip,
            price,
            beds,
            baths,
            sqft,
            image_urls
          )
        `)
        .eq('user_id', user.id)
        .order('added_at', { ascending: false });

      if (error) throw error;
      setPortfolio(data || []);
    } catch (error) {
      console.error('Error loading portfolio:', error);
      toast({
        title: "Error",
        description: "Failed to load portfolio",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveProperty = async (portfolioId: string) => {
    try {
      const { error } = await supabase
        .from('portfolio_properties')
        .delete()
        .eq('id', portfolioId);

      if (error) throw error;

      setPortfolio(prev => prev.filter(p => p.id !== portfolioId));
      toast({
        title: "Success",
        description: "Property removed from portfolio"
      });
    } catch (error) {
      console.error('Error removing property:', error);
      toast({
        title: "Error",
        description: "Failed to remove property",
        variant: "destructive"
      });
    }
  };

  if (subscriptionLoading || loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Upsell for Free users
  if (tier === "free") {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 rounded-full bg-primary/10 p-3 w-fit">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Investor Portfolio</CardTitle>
          <CardDescription className="text-base">
            Track your deals, analyze cash flow, and manage a small real estate portfolio with HomeLens Investor.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>✓ Track multiple properties</p>
            <p>✓ Combined cash flow analysis</p>
            <p>✓ Total ROI calculations</p>
            <p>✓ Portfolio performance metrics</p>
          </div>
          <Button onClick={() => navigate("/console?tab=subscription")} size="lg" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Upgrade to Pro
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Empty state for Pro/Premium users
  if (portfolio.length === 0) {
    return (
      <Card className="p-8 text-center">
        <TrendingUp className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-semibold mb-2">No properties in portfolio</h2>
        <p className="text-muted-foreground mb-6">
          Start building your portfolio by adding properties
        </p>
        <Button onClick={() => navigate("/")}>
          <Plus className="h-4 w-4 mr-2" />
          Browse Properties
        </Button>
      </Card>
    );
  }

  // Portfolio content for Pro/Premium users
  return (
    <div className="space-y-6">
      <PortfolioOverview portfolio={portfolio} />
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {portfolio.map((item) => (
          <PortfolioPropertyCard
            key={item.id}
            portfolioProperty={item}
            onRemove={handleRemoveProperty}
            onUpdate={loadPortfolio}
          />
        ))}
      </div>
    </div>
  );
}
