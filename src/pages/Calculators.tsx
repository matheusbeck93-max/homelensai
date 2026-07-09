import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RotateCcw, Save, DollarSign, Sparkles } from "lucide-react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useBudgetCap, parseAndRecordBudget402 } from "@/lib/ai/budgetCap";
import { BudgetCapBanner } from "@/components/ai/BudgetCapBanner";
import { BudgetCapBlocker } from "@/components/ai/BudgetCapBlocker";
import { BrrrrCalculatorPanel } from "@/pages/CalculatorBrrrr";

export default function Calculators() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const tabParam = searchParams.get("tab");
  const activeTab =
    tabParam === "mortgage" || tabParam === "brrrr" ? tabParam : "buying-power";
  const handleTabChange = (v: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", v);
    setSearchParams(next, { replace: true });
  };
  const [user, setUser] = useState<any>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [aiInsights, setAiInsights] = useState<string>("");
  const cap = useBudgetCap();
  const isCapExceeded = cap.warningLevel === "exceeded";

  // Buying Power Calculator
  const [annualIncome, setAnnualIncome] = useState(0);
  const [monthlyDebts, setMonthlyDebts] = useState(0);
  const [downPaymentAvailable, setDownPaymentAvailable] = useState(0);

  // Mortgage Calculator
  const [homePrice, setHomePrice] = useState(0);
  const [downPayment, setDownPayment] = useState(0);
  const [interestRate, setInterestRate] = useState(0);
  const [loanTerm, setLoanTerm] = useState(30);
  const [propertyTaxRate, setPropertyTaxRate] = useState(1.2);
  const [insuranceAnnual, setInsuranceAnnual] = useState(0);
  const [hoaMonthly, setHoaMonthly] = useState(0);
  const [pmiRate, setPmiRate] = useState(0.5); // Auto-populated with typical rate
  const [closingCosts, setClosingCosts] = useState(0);

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
    setHomePrice(0);
    setDownPayment(0);
    setInterestRate(0);
    setLoanTerm(30);
    setPropertyTaxRate(1.2);
    setInsuranceAnnual(0);
    setHoaMonthly(0);
    setPmiRate(0.5);
    setClosingCosts(0);
    setAiInsights("");
  };

  const handleResetBuyingPower = () => {
    setAnnualIncome(0);
    setMonthlyDebts(0);
    setDownPaymentAvailable(0);
  };

  const handleResetMortgage = () => {
    setHomePrice(0);
    setDownPayment(0);
    setInterestRate(0);
    setLoanTerm(30);
    setPropertyTaxRate(1.2);
    setInsuranceAnnual(0);
    setHoaMonthly(0);
    setPmiRate(0.5);
    setClosingCosts(0);
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
  
  // Maximum affordable monthly mortgage payment (28% of gross income, industry standard)
  // This is the max housing payment they can afford, separate from existing debts
  const maxAffordablePayment = monthlyIncome * 0.28;
  
  // Buying power is independent - just show what they can afford based on down payment
  const estimatedBuyingPower = downPaymentAvailable > 0 ? downPaymentAvailable / 0.20 : 0; // Assuming 20% down standard

  // Mortgage Calculations
  const loanAmount = homePrice - downPayment;
  const downPaymentPercent = homePrice > 0 ? (downPayment / homePrice) * 100 : 0;
  const monthlyInterestRate = interestRate / 100 / 12;
  const numberOfPayments = loanTerm * 12;
  
  // Calculate monthly P&I using amortization formula
  const monthlyPI = loanAmount > 0 && monthlyInterestRate > 0
    ? loanAmount * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfPayments)) / 
      (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1)
    : 0;
  
  // Property taxes (annual to monthly)
  const monthlyPropertyTax = (homePrice * (propertyTaxRate / 100)) / 12;
  
  // Insurance (annual to monthly)
  const monthlyInsurance = insuranceAnnual > 0 ? insuranceAnnual / 12 : (homePrice * 0.0035) / 12; // Estimate if not provided
  
  // PMI (only if down payment < 20%)
  const monthlyPMI = downPaymentPercent < 20 ? (loanAmount * (pmiRate / 100)) / 12 : 0;
  
  // Total monthly payment (PITI + HOA + PMI)
  const totalMonthlyPayment = monthlyPI + monthlyPropertyTax + monthlyInsurance + hoaMonthly + monthlyPMI;

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
          },
          mortgage: {
            homePrice,
            downPayment,
            downPaymentPercent: downPaymentPercent.toFixed(2),
            loanAmount,
            interestRate,
            loanTerm,
            monthlyPI: Math.round(monthlyPI),
            monthlyPropertyTax: Math.round(monthlyPropertyTax),
            monthlyInsurance: Math.round(monthlyInsurance),
            monthlyPMI: Math.round(monthlyPMI),
            hoaMonthly,
            totalMonthlyPayment: Math.round(totalMonthlyPayment),
            propertyTaxRate,
            insuranceAnnual,
            pmiRate,
            closingCosts
          }
        }
      });

      if (error) throw error;
      setAiInsights(data.insights);
    } catch (error: any) {
      const wasCap = await parseAndRecordBudget402(error, "calculator_insights");
      if (wasCap) return;
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
      <Helmet>
        <title>Mortgage & Buying Power Calculators | HomeLens</title>
        <meta name="description" content="Calculate your home buying power and monthly mortgage payments with taxes, insurance, PMI, and HOA. Free AI-powered calculators for US home buyers." />
        <link rel="canonical" href="https://homelensais.com/calculators" />
        <meta property="og:title" content="Mortgage & Buying Power Calculators | HomeLens" />
        <meta property="og:description" content="Calculate buying power and mortgage payments with taxes, PMI, HOA. Free AI-powered tools for US home buyers." />
        <meta property="og:url" content="https://homelensais.com/calculators" />
        <meta property="og:type" content="website" />
        <meta name="twitter:title" content="Mortgage & Buying Power Calculators | HomeLens" />
        <meta name="twitter:description" content="Calculate buying power and mortgage payments with taxes, PMI, HOA. Free AI-powered tools for US home buyers." />
      </Helmet>
      <Navigation />
      
      <div className="container mx-auto px-4 py-8 pb-24 lg:pb-8">
        <div className="mb-8 space-y-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">Financial Calculators</h1>
            <p className="text-muted-foreground">
              Calculate your buying power and mortgage payments
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Investor?{" "}
              <Link to="/calculators/brrrr" className="text-primary underline">
                Try the BRRRR calculator
              </Link>{" "}
              to model buy-rehab-rent-refinance deals.
            </p>
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

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Buying Power Summary */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle as="h2" className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Buying Power Summary
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleResetBuyingPower}
                    aria-label="Reset buying power"
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

            {/* Mortgage Calculator */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle as="h2" className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Mortgage Calculator
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleResetMortgage}
                    aria-label="Reset mortgage calculator"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription>Calculate your monthly PITI payment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Home Price ($)</Label>
                    <Input
                      type="number"
                      value={homePrice || ""}
                      onChange={(e) => setHomePrice(Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Down Payment ($)</Label>
                    <Input
                      type="number"
                      value={downPayment || ""}
                      onChange={(e) => setDownPayment(Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Interest Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={interestRate || ""}
                      onChange={(e) => setInterestRate(Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Loan Term (years)</Label>
                    <Input
                      type="number"
                      value={loanTerm || ""}
                      onChange={(e) => setLoanTerm(Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Property Tax Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={propertyTaxRate || ""}
                      onChange={(e) => setPropertyTaxRate(Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Annual Insurance ($)</Label>
                    <Input
                      type="number"
                      value={insuranceAnnual || ""}
                      onChange={(e) => setInsuranceAnnual(Number(e.target.value))}
                      className="mt-1"
                      placeholder="Auto-estimated if empty"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Monthly HOA ($)</Label>
                    <Input
                      type="number"
                      value={hoaMonthly || ""}
                      onChange={(e) => setHoaMonthly(Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Closing Costs ($)</Label>
                    <Input
                      type="number"
                      value={closingCosts || ""}
                      onChange={(e) => setClosingCosts(Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {/* Buying Power Results */}
            <Card>
              <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2">
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

            {/* Mortgage Results */}
            <Card>
              <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Monthly Payment Breakdown (PITI)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-sm text-muted-foreground">Principal & Interest</span>
                    <span className="font-semibold">${Math.round(monthlyPI).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-sm text-muted-foreground">Property Taxes</span>
                    <span className="font-semibold">${Math.round(monthlyPropertyTax).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-sm text-muted-foreground">Homeowners Insurance</span>
                    <span className="font-semibold">${Math.round(monthlyInsurance).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-sm text-muted-foreground">HOA Fees</span>
                    <span className="font-semibold">${hoaMonthly.toLocaleString()}</span>
                  </div>
                  {monthlyPMI > 0 && (
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-sm text-muted-foreground">PMI (Down &lt; 20%)</span>
                      <span className="font-semibold text-yellow-600">${Math.round(monthlyPMI).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2">
                    <span className="font-bold">Total Monthly Payment</span>
                    <span className="text-2xl font-bold text-primary">${Math.round(totalMonthlyPayment).toLocaleString()}</span>
                  </div>
                </div>
                {downPaymentPercent < 20 && (
                  <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded-lg space-y-1">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      ⚠️ PMI required: Down payment is {downPaymentPercent.toFixed(1)}% (less than 20%)
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                      PMI auto-populated with typical rate (0.5%). Adjust if needed.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Insights */}
            <Card>
              <CardHeader>
                <CardTitle as="h2" className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  💡 AI Insight
                </CardTitle>
                <CardDescription>Get personalized analysis from AI</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {cap.warningLevel === "approaching" && (
                  <BudgetCapBanner surface="calculator_insights" />
                )}
                {isCapExceeded && (
                  <BudgetCapBlocker surface="calculator_insights" compact />
                )}
                {!aiInsights ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      Generate AI-powered insights based on your buying power
                    </p>
                    <Button 
                      onClick={handleGenerateInsights}
                      disabled={isLoadingInsights || isCapExceeded}
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
                        disabled={isLoadingInsights || isCapExceeded}
                        className="flex-1"
                      >
                        Regenerate Insights
                      </Button>
                      <Button 
                        onClick={() => navigate('/chats', { 
                          state: { 
                            initialMessage: `[CALCULATORS_AI_INSIGHT]\n\n${aiInsights}`,
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
      </div>
    </div>
  );
}
