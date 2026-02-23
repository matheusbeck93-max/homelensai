import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calculator, Trash2, ArrowRight, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface SavedCalculation {
  id: string;
  name: string;
  calculation_type: string;
  data: any;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  "buying-power": "Buying Power",
  "mortgage": "Mortgage",
  "investor": "Investor",
};

export function SavedCalculatorsPanel() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [calculations, setCalculations] = useState<SavedCalculation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCalculations();
  }, []);

  const loadCalculations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("saved_calculations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCalculations(data || []);
    } catch (error) {
      console.error("Error loading calculations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("saved_calculations")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setCalculations((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "Deleted", description: "Calculation removed successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleOpen = (calc: SavedCalculation) => {
    navigate("/calculators", { state: { calculationData: calc.data } });
  };

  const formatValue = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(value);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (calculations.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Calculator className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">No saved calculations yet</p>
          <Button onClick={() => navigate("/calculators")}>
            Go to Calculators
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Saved Calculations</h3>
        <Button variant="outline" size="sm" onClick={() => navigate("/calculators")} className="gap-2">
          New Calculation
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3">
        {calculations.map((calc) => (
          <Card key={calc.id} className="hover:shadow-md transition-shadow">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => handleOpen(calc)}>
                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                  <Calculator className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{calc.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span className="bg-muted px-2 py-0.5 rounded">
                      {TYPE_LABELS[calc.calculation_type] || calc.calculation_type}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(calc.created_at), "MMM d, yyyy")}
                    </span>
                  </div>
                  {calc.data && (
                    <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                      {calc.data.annualIncome > 0 && (
                        <span>Income: {formatValue(calc.data.annualIncome)}</span>
                      )}
                      {calc.data.downPaymentAvailable > 0 && (
                        <span>Down: {formatValue(calc.data.downPaymentAvailable)}</span>
                      )}
                      {calc.data.homePrice > 0 && (
                        <span>Price: {formatValue(calc.data.homePrice)}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(calc.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
