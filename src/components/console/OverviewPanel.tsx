import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, MessageSquare, Sparkles, Calculator, ArrowRight, CreditCard, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SavedCalculatorsPanel } from "@/components/console/SavedCalculatorsPanel";
import { UsageSummaryCard } from "@/components/console/UsageSummaryCard";
import { WeeklyReviewCard } from "@/components/stickiness/WeeklyReviewCard";

const GOAL_LABELS: Record<string, string> = {
  buy_home: "Buy a home to live in",
  rent: "Rent a property",
  invest: "Invest in real estate",
  market_trends: "Track market trends",
  tax_incentives: "Find tax & financial incentives",
};

export function OverviewPanel() {
  const navigate = useNavigate();
  const { tier } = useSubscription();
  const [fullName, setFullName] = useState("");
  const [primaryGoal, setPrimaryGoal] = useState<string | null>(null);
  const [chatsCount, setChatsCount] = useState(0);
  const [savedCalcsCount, setSavedCalcsCount] = useState(0);
  const [savedAnalysesCount, setSavedAnalysesCount] = useState(0);
  const [showSavedCalcs, setShowSavedCalcs] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, primary_goal")
        .eq("id", user.id)
        .single();

      if (profile?.full_name) {
        setFullName(profile.full_name.split(" ")[0]);
      }
      setPrimaryGoal(profile?.primary_goal || null);

      const { count: chatCount } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      setChatsCount(chatCount || 0);

      const { count: calcCount } = await supabase
        .from("saved_calculations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      setSavedCalcsCount(calcCount || 0);

      const { count: analysesCount } = await supabase
        .from("saved_analyses" as any)
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      setSavedAnalysesCount(analysesCount || 0);
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">
          Hi{fullName ? `, ${fullName}` : " there"} 👋
        </h2>
        <p className="text-muted-foreground">Here's an overview of your HomeLens activity</p>
      </div>

      <WeeklyReviewCard />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/console?tab=account")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Primary Goal</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold leading-tight">
              {primaryGoal ? GOAL_LABELS[primaryGoal] || primaryGoal : "Not set"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Your main objective</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/chats")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chats</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{chatsCount}</div>
            <p className="text-xs text-muted-foreground">Conversations</p>
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

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setShowSavedCalcs(!showSavedCalcs)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saved Calculators</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{savedCalcsCount}</div>
            <p className="text-xs text-muted-foreground">Financial simulations</p>
          </CardContent>
        </Card>
      </div>

      <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/saved-analyses")}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Saved Analyses</CardTitle>
          <Bookmark className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">{savedAnalysesCount}</div>
            <p className="text-xs text-muted-foreground">Property due diligence history</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>

      {showSavedCalcs && <SavedCalculatorsPanel />}

      <UsageSummaryCard />

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Change Plan</p>
              <p className="text-sm text-muted-foreground">Upgrade or manage your subscription</p>
            </div>
          </div>
          <Button onClick={() => navigate("/console?tab=subscription")} variant="outline" className="gap-2">
            View Plans
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
