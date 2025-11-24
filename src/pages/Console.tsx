import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Heart, Bell, Briefcase, CreditCard, Settings, Zap } from "lucide-react";
import { OverviewPanel } from "@/components/console/OverviewPanel";
import { FavoritesPanel } from "@/components/console/FavoritesPanel";
import { SavedSearchesPanel } from "@/components/console/SavedSearchesPanel";
import { InvestorPortfolioPanel } from "@/components/console/InvestorPortfolioPanel";
import { SubscriptionPanel } from "@/components/console/SubscriptionPanel";
import { AccountPreferencesPanel } from "@/components/console/AccountPreferencesPanel";
import { AlertsPanel } from "@/components/console/AlertsPanel";

export default function Console() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const activeTab = searchParams.get("tab") || "overview";

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUser(user);
    } catch (error) {
      console.error("Auth error:", error);
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold mb-4">Welcome to My HomeLens</h1>
          <p className="text-muted-foreground mb-8">
            Create a free HomeLens account to save favorites, manage searches and use investor tools.
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => navigate("/auth?mode=signup")} size="lg">
              Sign Up
            </Button>
            <Button onClick={() => navigate("/auth")} variant="outline" size="lg">
              Log In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="container mx-auto px-4 py-8 pt-24 pb-24 lg:pb-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">My HomeLens</h1>
          <p className="text-muted-foreground">
            Your real estate HQ – favorites, searches, portfolio & settings
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="overflow-x-auto mb-8 -mx-4 px-4">
            <TabsList className="inline-flex w-auto min-w-full lg:grid lg:w-full lg:grid-cols-7 gap-1">
              <TabsTrigger value="overview" className="gap-2 flex-shrink-0">
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="favorites" className="gap-2 flex-shrink-0">
                <Heart className="h-4 w-4" />
                <span className="hidden sm:inline">Favorites</span>
              </TabsTrigger>
              <TabsTrigger value="searches" className="gap-2 flex-shrink-0">
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">Searches</span>
              </TabsTrigger>
              <TabsTrigger value="alerts" className="gap-2 flex-shrink-0">
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">Alerts</span>
              </TabsTrigger>
              <TabsTrigger value="portfolio" className="gap-2 flex-shrink-0">
                <Briefcase className="h-4 w-4" />
                <span className="hidden sm:inline">Portfolio</span>
              </TabsTrigger>
              <TabsTrigger value="subscription" className="gap-2 flex-shrink-0">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">Plan</span>
              </TabsTrigger>
              <TabsTrigger value="account" className="gap-2 flex-shrink-0">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Account</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview">
            <OverviewPanel />
          </TabsContent>

          <TabsContent value="favorites">
            <FavoritesPanel />
          </TabsContent>

          <TabsContent value="searches">
            <SavedSearchesPanel />
          </TabsContent>

          <TabsContent value="alerts">
            <AlertsPanel />
          </TabsContent>

          <TabsContent value="portfolio">
            <InvestorPortfolioPanel />
          </TabsContent>

          <TabsContent value="subscription">
            <SubscriptionPanel />
          </TabsContent>

          <TabsContent value="account">
            <AccountPreferencesPanel />
          </TabsContent>
        </Tabs>
      </div>

      <MobileBottomNav />
    </div>
  );
}
