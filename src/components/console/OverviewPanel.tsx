import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { useFavorites } from "@/contexts/FavoritesContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Search, TrendingUp, Sparkles, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function OverviewPanel() {
  const navigate = useNavigate();
  const { tier } = useSubscription();
  const { favorites } = useFavorites();
  const [fullName, setFullName] = useState("");
  const [savedSearchesCount, setSavedSearchesCount] = useState(0);
  const [portfolioCount, setPortfolioCount] = useState(0);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load profile name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (profile?.full_name) {
        setFullName(profile.full_name.split(" ")[0]); // Get first name
      }

      // Load saved searches count
      const { count: searchCount } = await supabase
        .from("saved_searches")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      setSavedSearchesCount(searchCount || 0);

      // Load portfolio count
      const { count: portCount } = await supabase
        .from("portfolio_properties")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      setPortfolioCount(portCount || 0);
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  const getNextStepSuggestion = () => {
    if (tier === "free") {
      return {
        title: "Unlock Pro Features",
        description: "Upgrade to Pro to unlock unlimited AI analyses, price fairness meter, property comparison, and smart alerts.",
        action: "Upgrade to Pro",
        onClick: () => navigate("/console?tab=subscription"),
        icon: Sparkles,
      };
    }

    if (tier === "pro") {
      return {
        title: "Try Portfolio Builder",
        description: "Upgrade to Premium to track multiple properties with deep investment projections and monthly reports.",
        action: "Explore Premium",
        onClick: () => navigate("/console?tab=subscription"),
        icon: TrendingUp,
      };
    }

    return {
      title: "Build Your Portfolio",
      description: "Start tracking your investment properties with our Premium Portfolio Builder.",
      action: "Go to Portfolio",
      onClick: () => navigate("/console?tab=portfolio"),
      icon: TrendingUp,
    };
  };

  const suggestion = getNextStepSuggestion();
  const SuggestionIcon = suggestion.icon;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold">
          Hi{fullName ? `, ${fullName}` : " there"} 👋
        </h2>
        <p className="text-muted-foreground">Here's an overview of your HomeLens activity</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/console?tab=favorites")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Favorite Properties</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{favorites.length}</div>
            <p className="text-xs text-muted-foreground">Properties saved</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/console?tab=searches")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saved Searches</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{savedSearchesCount}</div>
            <p className="text-xs text-muted-foreground">Active searches</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/console?tab=subscription")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{tier}</div>
            <p className="text-xs text-muted-foreground">Subscription tier</p>
          </CardContent>
        </Card>

        {tier === "premium" && (
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/console?tab=portfolio")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Portfolio</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{portfolioCount}</div>
              <p className="text-xs text-muted-foreground">Tracked investments</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your most recently favorited properties</CardDescription>
        </CardHeader>
        <CardContent>
          {favorites.length === 0 ? (
            <div className="text-center py-8">
              <Heart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No favorite properties yet</p>
              <Button onClick={() => navigate("/")}>Find Properties</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {favorites.slice(0, 5).map((property) => (
                <div
                  key={property.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/property/${property.id}`)}
                >
                  <div className="flex-1">
                    <p className="font-medium">{property.address}</p>
                    <p className="text-sm text-muted-foreground">
                      {property.city}, {property.state}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      ${property.price?.toLocaleString() || "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {property.beds} bed • {property.baths} bath
                    </p>
                  </div>
                </div>
              ))}
              {favorites.length > 5 && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => navigate("/console?tab=favorites")}
                >
                  View all {favorites.length} favorites
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suggested Next Steps */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SuggestionIcon className="h-5 w-5 text-primary" />
            {suggestion.title}
          </CardTitle>
          <CardDescription>{suggestion.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={suggestion.onClick} className="gap-2">
            {suggestion.action}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
