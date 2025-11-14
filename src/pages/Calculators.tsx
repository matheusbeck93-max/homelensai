import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCcw, Save, ArrowLeft, DollarSign, Sparkles } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Calculators() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [aiInsights, setAiInsights] = useState<string>("");

  // Buying Power Calculator
  const [annualIncome, setAnnualIncome] = useState(0);
  const [monthlyDebts, setMonthlyDebts] = useState(0);
  const [downPaymentAvailable, setDownPaymentAvailable] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate('/auth?redirect=/calculators');
        return;
      }
    };
    checkAuth();

    // Load saved calculation data if passed from navigation
    if (location.state?.calculationData) {
      const data = location.state.calculationData;
      setAnnualIncome(data.annualIncome || 0);
      setMonthlyDebts(data.monthlyDebts || 0);
      setDownPaymentAvailable(data.downPaymentAvailable || 0);
    }
  }, [navigate, location.state]);

  const handleReset = () => {
    setAnnualIncome(0);
    setMonthlyDebts(0);
    setDownPaymentAvailable(0);
    setAiInsights("");
  };

  const handleSave = async () => {
    if (!user) return;
    
    const calculationData = {
      annualIncome,
      monthlyDebts,
      downPaymentAvailable
    };

    try {
      const { error } = await supabase
        .from('saved_calculations')
        .insert([{
          user_id: user.id,
          name: `Buying Power ${new Date().toLocaleDateString()}`,
          calculation_type: 'buying-power',
          data: calculationData
        }]);

      if (error) throw error;

      toast({
        title: "Saved",
        description: "Your calculation has been saved successfully"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Buying Power Calculations (independent of financing terms)
  const monthlyIncome = annualIncome / 12;
  
  // Calculate actual DTI based on income and debts
  const actualDTI = monthlyIncome > 0 ? (monthlyDebts / monthlyIncome) * 100 : 0;
  
  // Maximum affordable monthly payment (using 30% DTI standard)
  const maxAffordablePayment = (monthlyIncome * 0.30) - monthlyDebts;
  
  // Buying power is independent - just show what they can afford based on down payment
  const estimatedBuyingPower = downPaymentAvailable > 0 ? downPaymentAvailable / 0.20 : 0; // Assuming 20% down standard

  const handleGenerateInsights = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to generate AI insights",
        variant: "destructive"
      });
      return;
    }

    setIsLoadingInsights(true);
    try {
      const { data, error } = await supabase.functions.invoke("calculator-insights", {
        body: {
          buyingPower: {
            annualIncome,
            monthlyDebts,
            downPaymentAvailable,
            estimatedBuyingPower: Math.round(estimatedBuyingPower),
            maxAffordablePayment: Math.round(maxAffordablePayment),
            actualDTI: actualDTI.toFixed(2)
          }
        }
      });

      if (error) throw error;
      setAiInsights(data.insights);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoadingInsights(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Buying Power Calculator</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            {user && (
              <Button variant="outline" size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Buying Power Summary */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Buying Power Summary
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setAnnualIncome(0);
                      setMonthlyDebts(0);
                      setDownPaymentAvailable(0);
                    }}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription>Calculate your home buying capacity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Annual Income (USD)</Label>
                  <Input
                    type="number"
                    value={annualIncome || ""}
                    onChange={(e) => setAnnualIncome(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Monthly Debts (USD)</Label>
                  <Input
                    type="number"
                    value={monthlyDebts || ""}
                    onChange={(e) => setMonthlyDebts(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Down Payment Available (USD)</Label>
                  <Input
                    type="number"
                    value={downPaymentAvailable || ""}
                    onChange={(e) => setDownPaymentAvailable(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {/* Buying Power Results */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Buying Power Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Your DTI Ratio</p>
                    <p className={`text-2xl font-bold ${actualDTI < 30 ? 'text-green-600' : actualDTI < 43 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {actualDTI.toFixed(1)}%
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Estimated Buying Power</p>
                    <p className="text-2xl font-bold text-primary">${Math.round(estimatedBuyingPower).toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Max Affordable Payment</p>
                    <p className="text-2xl font-bold">${Math.round(maxAffordablePayment).toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Down Payment Available</p>
                    <p className="text-2xl font-bold">${downPaymentAvailable.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  💡 AI Insight
                </CardTitle>
                <CardDescription>Get personalized analysis from AI</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!aiInsights ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      Generate AI-powered insights based on your buying power
                    </p>
                    <Button 
                      onClick={handleGenerateInsights}
                      disabled={isLoadingInsights}
                    >
                      {isLoadingInsights ? "Generating..." : "Generate Insights"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <div className="space-y-2 text-foreground whitespace-pre-wrap">
                        {aiInsights}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        onClick={handleGenerateInsights}
                        disabled={isLoadingInsights}
                        className="flex-1"
                      >
                        Regenerate Insights
                      </Button>
                      <Button 
                        onClick={() => navigate('/chat', { 
                          state: { 
                            initialMessage: aiInsights,
                            newConversation: true,
                            skipAuthCheck: true
                          } 
                        })}
                        className="flex-1"
                      >
                        Start Chat with this Insight
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
