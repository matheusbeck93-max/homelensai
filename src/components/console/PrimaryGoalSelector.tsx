import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Target, Home, Building, TrendingUp, BarChart3, Receipt, Save, Loader2 } from "lucide-react";

const GOALS = [
  {
    value: "buy_home",
    label: "Comprar imóvel para moradia",
    labelEn: "Buy a home to live in",
    description: "Find the perfect home for you and your family",
    icon: Home,
  },
  {
    value: "rent",
    label: "Alugar imóvel",
    labelEn: "Rent a property",
    description: "Find rental properties that fit your lifestyle",
    icon: Building,
  },
  {
    value: "invest",
    label: "Investir em imóveis",
    labelEn: "Invest in real estate",
    description: "Maximize ROI with investment properties",
    icon: TrendingUp,
  },
  {
    value: "market_trends",
    label: "Acompanhar tendências de mercado",
    labelEn: "Track market trends",
    description: "Stay informed on market data and forecasts",
    icon: BarChart3,
  },
  {
    value: "tax_incentives",
    label: "Buscar incentivos fiscais/financeiros",
    labelEn: "Find tax & financial incentives",
    description: "Discover programs, grants, and tax benefits",
    icon: Receipt,
  },
] as const;

export function PrimaryGoalSelector() {
  const [selectedGoal, setSelectedGoal] = useState<string>("");
  const [savedGoal, setSavedGoal] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadGoal();
  }, []);

  const loadGoal = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("primary_goal")
        .eq("id", user.id)
        .single();

      if (data?.primary_goal) {
        setSelectedGoal(data.primary_goal);
        setSavedGoal(data.primary_goal);
      }
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({ primary_goal: selectedGoal } as any)
        .eq("id", user.id);

      if (error) throw error;

      setSavedGoal(selectedGoal);
      toast({
        title: "Goal saved",
        description: "Your primary goal has been updated. The AI assistant will now personalize responses based on this.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const hasChanges = selectedGoal !== savedGoal;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Primary Goal
        </CardTitle>
        <CardDescription>
          Tell us your main objective so the AI assistant can personalize recommendations, language, and calculations to your needs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup value={selectedGoal} onValueChange={setSelectedGoal} className="space-y-3">
          {GOALS.map((goal) => {
            const Icon = goal.icon;
            return (
              <label
                key={goal.value}
                htmlFor={goal.value}
                className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedGoal === goal.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <RadioGroupItem value={goal.value} id={goal.value} />
                <Icon className={`h-5 w-5 flex-shrink-0 ${selectedGoal === goal.value ? "text-primary" : "text-muted-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <Label htmlFor={goal.value} className="font-medium cursor-pointer">
                    {goal.labelEn}
                  </Label>
                  <p className="text-sm text-muted-foreground">{goal.description}</p>
                </div>
              </label>
            );
          })}
        </RadioGroup>

        <Button onClick={handleSave} disabled={loading || !selectedGoal || !hasChanges}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Goal
        </Button>
      </CardContent>
    </Card>
  );
}
