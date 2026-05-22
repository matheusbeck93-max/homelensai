import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeModal } from "@/components/subscription/UpgradeModal";
import { PortfolioOverview } from "@/components/portfolio/PortfolioOverview";
import { PortfolioPropertyCard } from "@/components/portfolio/PortfolioPropertyCard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface PortfolioProperty {
  id: string;
  property_id: string;
  purchase_price: number;
  down_payment_pct: number;
  interest_rate_pct: number;
  loan_term_years: number;
  monthly_rent: number;
  monthly_expenses: number;
  notes: string | null;
  added_at: string;
  property: {
    id: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    price: number;
    beds: number;
    baths: number;
    sqft: number;
    image_urls: string[] | null;
  };
}

export default function Portfolio() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasAccess, loading: subscriptionLoading } = useSubscription();
  const hasPortfolioAccess = hasAccess('PORTFOLIO_TRACKING');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [portfolio, setPortfolio] = useState<PortfolioProperty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!subscriptionLoading && !hasPortfolioAccess) {
      setShowUpgrade(true);
    }
  }, [subscriptionLoading, hasPortfolioAccess]);

  useEffect(() => {
    if (hasPortfolioAccess) {
      loadPortfolio();
    }
  }, [hasPortfolioAccess]);

  const loadPortfolio = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">My Portfolio</h1>
              <p className="text-muted-foreground">Track and analyze your property investments</p>
            </div>
          </div>
           <Button onClick={() => navigate('/')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Property
          </Button>
        </div>

        {portfolio.length > 0 ? (
          <>
            <PortfolioOverview portfolio={portfolio} />
            
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {portfolio.map((item) => (
                <PortfolioPropertyCard
                  key={item.id}
                  portfolioProperty={item}
                  onRemove={handleRemoveProperty}
                  onUpdate={loadPortfolio}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <h2 className="text-2xl font-semibold mb-2">No properties in portfolio</h2>
            <p className="text-muted-foreground mb-6">
              Start building your portfolio by adding properties
            </p>
            <Button onClick={() => navigate('/')}>
              <Plus className="h-4 w-4 mr-2" />
              Browse Properties
            </Button>
          </div>
        )}
      </div>

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => {
          setShowUpgrade(false);
          navigate('/');
        }}
        reason="Portfolio Builder is a Premium feature"
        feature="Track multiple properties with combined cash flow analysis, total ROI calculations, and portfolio performance metrics"
      />
    </div>
  );
}
