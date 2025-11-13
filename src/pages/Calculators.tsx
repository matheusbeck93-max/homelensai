import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Home, Download, RotateCcw, Save, ArrowLeft, DollarSign, TrendingUp, Percent, Calendar, Info, Sparkles } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";

export default function Calculators() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [aiInsights, setAiInsights] = useState<string>("");

  // Property Information
  const [propertyPrice, setPropertyPrice] = useState(0);
  const [propertyType, setPropertyType] = useState("House");
  const [propertyLocation, setPropertyLocation] = useState("");
  const [annualAppreciation, setAnnualAppreciation] = useState(0);

  // Financing Details
  const [downPayment, setDownPayment] = useState(0);
  const [loanTerm, setLoanTerm] = useState(30);
  const [interestRate, setInterestRate] = useState(0);
  const [closingCostsPercent, setClosingCostsPercent] = useState(0);
  const [propertyTaxPercent, setPropertyTaxPercent] = useState(0);
  const [homeInsurance, setHomeInsurance] = useState(0);
  const [hoaFees, setHoaFees] = useState(0);

  // Additional Costs & Rental Income
  const [renovationCosts, setRenovationCosts] = useState(0);
  const [maintenanceCosts, setMaintenanceCosts] = useState(0);
  const [managementFeePercent, setManagementFeePercent] = useState(0);
  const [monthlyRent, setMonthlyRent] = useState(0);
  const [vacancyRate, setVacancyRate] = useState(0);
  const [incomeTaxRate, setIncomeTaxRate] = useState(0);

  // Buying Power Calculator
  const [annualIncome, setAnnualIncome] = useState(0);
  const [monthlyDebts, setMonthlyDebts] = useState(0);
  const [downPaymentAvailable, setDownPaymentAvailable] = useState(0);
  const [buyingPowerInterestRate, setBuyingPowerInterestRate] = useState(0);
  const [buyingPowerLoanTerm, setBuyingPowerLoanTerm] = useState(30);
  const [scenario, setScenario] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (!session) {
        setShowAuthModal(true);
      }
    };
    checkAuth();

    // Load saved calculation data if passed from navigation
    if (location.state?.calculationData) {
      const data = location.state.calculationData;
      setPropertyPrice(data.propertyPrice || 0);
      setPropertyType(data.propertyType || "House");
      setPropertyLocation(data.propertyLocation || "");
      setAnnualAppreciation(data.annualAppreciation || 0);
      setDownPayment(data.downPayment || 0);
      setLoanTerm(data.loanTerm || 30);
      setInterestRate(data.interestRate || 0);
      setClosingCostsPercent(data.closingCostsPercent || 0);
      setPropertyTaxPercent(data.propertyTaxPercent || 0);
      setHomeInsurance(data.homeInsurance || 0);
      setHoaFees(data.hoaFees || 0);
      setRenovationCosts(data.renovationCosts || 0);
      setMaintenanceCosts(data.maintenanceCosts || 0);
      setManagementFeePercent(data.managementFeePercent || 0);
      setMonthlyRent(data.monthlyRent || 0);
      setVacancyRate(data.vacancyRate || 0);
      setIncomeTaxRate(data.incomeTaxRate || 0);
      setAnnualIncome(data.annualIncome || 0);
      setMonthlyDebts(data.monthlyDebts || 0);
      setDownPaymentAvailable(data.downPaymentAvailable || 0);
      setBuyingPowerInterestRate(data.buyingPowerInterestRate || 0);
      setBuyingPowerLoanTerm(data.buyingPowerLoanTerm || 30);
      setScenario(data.scenario || 'moderate');
      setAiInsights(data.aiInsights || "");
    }
  }, []);

  // Calculations
  const downPaymentAmount = downPayment;
  const loanAmount = propertyPrice - downPaymentAmount;
  const closingCosts = (propertyPrice * closingCostsPercent) / 100;
  const totalAcquisition = propertyPrice + closingCosts + renovationCosts;

  // Monthly mortgage payment (P&I)
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = loanTerm * 12;
  const monthlyMortgage = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);

  // Monthly costs
  const monthlyPropertyTax = (propertyPrice * propertyTaxPercent) / 100 / 12;
  const monthlyInsurance = homeInsurance / 12;
  const monthlyMaintenance = maintenanceCosts / 12;
  const totalMonthlyCost = monthlyMortgage + monthlyPropertyTax + monthlyInsurance + hoaFees + monthlyMaintenance;

  // Rental calculations
  const effectiveMonthlyRent = monthlyRent * (1 - vacancyRate / 100);
  const managementFee = (effectiveMonthlyRent * managementFeePercent) / 100;
  const monthlyCashFlow = effectiveMonthlyRent - managementFee - totalMonthlyCost;
  const annualNetIncome = (monthlyCashFlow * 12) * (1 - incomeTaxRate / 100);
  const totalInvestment = downPaymentAmount + closingCosts + renovationCosts;
  const annualROI = totalInvestment > 0 ? (annualNetIncome / totalInvestment) * 100 : 0;
  const paybackPeriod = annualNetIncome > 0 ? totalInvestment / annualNetIncome : 0;

  // Property value projection
  const futureValue = (years: number) => propertyPrice * Math.pow(1 + annualAppreciation / 100, years);

  // Chart data
  const chartData = Array.from({ length: 11 }, (_, i) => ({
    year: i,
    propertyValue: futureValue(i),
    investment: totalInvestment,
    equity: futureValue(i) - (loanAmount - (monthlyMortgage * 12 * i * 0.3)) // simplified equity calc
  }));

  const cashFlowData = Array.from({ length: 11 }, (_, i) => ({
    year: i,
    cashFlow: monthlyCashFlow * 12 * i,
    netIncome: annualNetIncome * i
  }));

  const handleReset = () => {
    setPropertyPrice(0);
    setPropertyType("House");
    setPropertyLocation("");
    setAnnualAppreciation(0);
    setDownPayment(0);
    setLoanTerm(30);
    setInterestRate(0);
    setClosingCostsPercent(0);
    setPropertyTaxPercent(0);
    setHomeInsurance(0);
    setHoaFees(0);
    setRenovationCosts(0);
    setMaintenanceCosts(0);
    setManagementFeePercent(0);
    setMonthlyRent(0);
    setVacancyRate(0);
    setIncomeTaxRate(0);
    setAnnualIncome(0);
    setMonthlyDebts(0);
    setDownPaymentAvailable(0);
    setBuyingPowerInterestRate(0);
    setBuyingPowerLoanTerm(30);
    setScenario('moderate');
    setAiInsights("");
    toast({
      title: "Reset Successful",
      description: "All values have been reset"
    });
  };

  const handleSave = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to save simulations",
        variant: "destructive"
      });
      return;
    }

    try {
      const calculationData = {
        propertyPrice,
        propertyType,
        propertyLocation,
        annualAppreciation,
        downPayment,
        loanTerm,
        interestRate,
        closingCostsPercent,
        propertyTaxPercent,
        homeInsurance,
        hoaFees,
        renovationCosts,
        maintenanceCosts,
        managementFeePercent,
        monthlyRent,
        vacancyRate,
        incomeTaxRate,
        annualIncome,
        monthlyDebts,
        downPaymentAvailable,
        buyingPowerInterestRate,
        buyingPowerLoanTerm,
        scenario,
        aiInsights
      };

      const { error } = await supabase
        .from('saved_calculations')
        .insert([{
          user_id: user.id,
          name: propertyLocation || `Calculation ${new Date().toLocaleDateString()}`,
          calculation_type: 'investment',
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

  const handleDownloadPDF = () => {
    toast({
      title: "Coming Soon",
      description: "PDF download feature will be available soon"
    });
  };

  // Buying Power Calculations
  const monthlyIncome = annualIncome / 12;
  
  // DTI based on scenario
  const dtiRatio = scenario === 'conservative' ? 0.28 : scenario === 'moderate' ? 0.30 : 0.43;
  const maxMonthlyPayment = (monthlyIncome * dtiRatio) - monthlyDebts;
  
  const buyingPowerMonthlyRate = buyingPowerInterestRate / 100 / 12;
  const buyingPowerNumPayments = buyingPowerLoanTerm * 12;
  const maxLoanAmount = maxMonthlyPayment * (Math.pow(1 + buyingPowerMonthlyRate, buyingPowerNumPayments) - 1) / 
    (buyingPowerMonthlyRate * Math.pow(1 + buyingPowerMonthlyRate, buyingPowerNumPayments));
  
  const maxPurchasePrice = maxLoanAmount + downPaymentAvailable;

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
          financialSummary: {
            propertyPrice,
            downPaymentAmount,
            loanAmount,
            totalAcquisition,
            monthlyMortgage: Math.round(monthlyMortgage),
            totalMonthlyCost: Math.round(totalMonthlyCost),
            monthlyCashFlow: monthlyRent > 0 ? Math.round(monthlyCashFlow) : null,
            annualROI: monthlyRent > 0 ? annualROI : null,
            paybackPeriod: monthlyRent > 0 ? paybackPeriod : null
          },
          buyingPower: {
            annualIncome,
            monthlyDebts,
            downPaymentAvailable,
            maxPurchasePrice: Math.round(maxPurchasePrice),
            maxLoanAmount: Math.round(maxLoanAmount),
            maxMonthlyPayment: Math.round(maxMonthlyPayment),
            scenario: scenario.charAt(0).toUpperCase() + scenario.slice(1),
            dtiRatio: Math.round(dtiRatio * 100)
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
      {/* Auth Modal */}
      <Dialog open={showAuthModal} onOpenChange={(open) => {
        if (!open && !user) {
          navigate('/');
        }
        setShowAuthModal(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Authentication Required</DialogTitle>
            <DialogDescription>
              You need to be logged in to access the Investment Calculator.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button onClick={() => navigate('/auth?mode=signup')}>
              Sign Up
            </Button>
            <Button variant="outline" onClick={() => navigate('/auth?mode=login')}>
              Log In
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Investment Calculator</h1>
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
            <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Property Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5 text-primary" />
                  Property Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Property Price (USD)</Label>
                  <Input
                    type="number"
                    value={propertyPrice}
                    onChange={(e) => setPropertyPrice(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Property Type</Label>
                  <Select value={propertyType} onValueChange={setPropertyType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="House">House</SelectItem>
                      <SelectItem value="Apartment">Apartment</SelectItem>
                      <SelectItem value="Condo">Condo</SelectItem>
                      <SelectItem value="Commercial">Commercial</SelectItem>
                      <SelectItem value="Land">Land</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Location (Optional)</Label>
                  <Input
                    value={propertyLocation}
                    onChange={(e) => setPropertyLocation(e.target.value)}
                    placeholder="City, State"
                    className="mt-1"
                  />
                </div>
                <div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label className="flex items-center gap-1 cursor-help">
                          Expected Annual Appreciation (%)
                          <Info className="h-3 w-3" />
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Average annual increase in property value</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Input
                    type="number"
                    step="0.1"
                    value={annualAppreciation}
                    onChange={(e) => setAnnualAppreciation(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Financing Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Financing Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Down Payment ($)</Label>
                  <Input
                    type="number"
                    value={downPayment}
                    onChange={(e) => setDownPayment(Number(e.target.value))}
                    min="0"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Loan Term (years)</Label>
                  <Input
                    type="number"
                    value={loanTerm}
                    onChange={(e) => setLoanTerm(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Annual Interest Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={interestRate}
                    onChange={(e) => setInterestRate(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Closing Costs (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={closingCostsPercent}
                    onChange={(e) => setClosingCostsPercent(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Property Tax (% annual)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={propertyTaxPercent}
                    onChange={(e) => setPropertyTaxPercent(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Homeowners Insurance (USD/year)</Label>
                  <Input
                    type="number"
                    value={homeInsurance}
                    onChange={(e) => setHomeInsurance(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>HOA Fees (USD/month)</Label>
                  <Input
                    type="number"
                    value={hoaFees}
                    onChange={(e) => setHoaFees(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Additional Costs & Rental Income */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Investment Scenario
                </CardTitle>
                <CardDescription>For rental/investment properties</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Renovation Costs (USD)</Label>
                  <Input
                    type="number"
                    value={renovationCosts}
                    onChange={(e) => setRenovationCosts(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Annual Maintenance (USD)</Label>
                  <Input
                    type="number"
                    value={maintenanceCosts}
                    onChange={(e) => setMaintenanceCosts(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Management Fees (% of rent)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={managementFeePercent}
                    onChange={(e) => setManagementFeePercent(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Monthly Rent (USD)</Label>
                  <Input
                    type="number"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Vacancy Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={vacancyRate}
                    onChange={(e) => setVacancyRate(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Income Tax Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={incomeTaxRate}
                    onChange={(e) => setIncomeTaxRate(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Buying Power Calculator */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Buying Power Summary
                </CardTitle>
                <CardDescription>Calculate your purchasing power</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Scenario</Label>
                  <Select value={scenario} onValueChange={(value: any) => setScenario(value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">Conservative (28% DTI)</SelectItem>
                      <SelectItem value="moderate">Moderate (30% DTI)</SelectItem>
                      <SelectItem value="aggressive">Aggressive (43% DTI)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Annual Income (USD)</Label>
                  <Input
                    type="number"
                    value={annualIncome}
                    onChange={(e) => setAnnualIncome(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Monthly Debts (USD)</Label>
                  <Input
                    type="number"
                    value={monthlyDebts}
                    onChange={(e) => setMonthlyDebts(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Down Payment Available (USD)</Label>
                  <Input
                    type="number"
                    value={downPaymentAvailable}
                    onChange={(e) => setDownPaymentAvailable(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Interest Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={buyingPowerInterestRate}
                    onChange={(e) => setBuyingPowerInterestRate(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Loan Term (years)</Label>
                  <Input
                    type="number"
                    value={buyingPowerLoanTerm}
                    onChange={(e) => setBuyingPowerLoanTerm(Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {/* Summary Results */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5 text-primary" />
                  Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Down Payment</p>
                    <p className="text-2xl font-bold">${downPaymentAmount.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Loan Amount</p>
                    <p className="text-2xl font-bold">${loanAmount.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Acquisition</p>
                    <p className="text-2xl font-bold">${totalAcquisition.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Monthly Payment</p>
                    <p className="text-2xl font-bold">${Math.round(monthlyMortgage).toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Monthly Cost</p>
                    <p className="text-2xl font-bold">${Math.round(totalMonthlyCost).toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Loan Payment</p>
                    <p className="text-2xl font-bold">${Math.round(monthlyMortgage * numPayments).toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Investment Results */}
            {monthlyRent > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Investment Returns
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Monthly Cash Flow</p>
                      <p className={`text-2xl font-bold ${monthlyCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${Math.round(monthlyCashFlow).toLocaleString()}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Annual Net Income</p>
                      <p className={`text-2xl font-bold ${annualNetIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${Math.round(annualNetIncome).toLocaleString()}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Annual ROI</p>
                      <p className={`text-2xl font-bold ${annualROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {annualROI.toFixed(2)}%
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Payback Period</p>
                      <p className="text-2xl font-bold">
                        {paybackPeriod > 0 && paybackPeriod < 100 ? `${paybackPeriod.toFixed(1)} yrs` : 'N/A'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

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
                    <p className="text-sm text-muted-foreground">Max Purchase Price</p>
                    <p className="text-2xl font-bold text-primary">${Math.round(maxPurchasePrice).toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Max Loan Amount</p>
                    <p className="text-2xl font-bold">${Math.round(maxLoanAmount).toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Max Monthly Payment</p>
                    <p className="text-2xl font-bold">${Math.round(maxMonthlyPayment).toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Down Payment</p>
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
                      Generate AI-powered insights based on your financial summary and buying power
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
                            newConversation: true 
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

            {/* Property Value Projection Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Property Value Projection</CardTitle>
                <CardDescription>Based on {annualAppreciation}% annual appreciation</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" label={{ value: 'Years', position: 'insideBottom', offset: -5 }} />
                    <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                    <RechartsTooltip formatter={(value: any) => `$${value.toLocaleString()}`} />
                    <Legend />
                    <Line type="monotone" dataKey="propertyValue" stroke="hsl(var(--primary))" name="Property Value" strokeWidth={2} />
                    <Line type="monotone" dataKey="equity" stroke="hsl(var(--accent))" name="Equity" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cash Flow Projection */}
            {monthlyRent > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Cash Flow Projection</CardTitle>
                  <CardDescription>Cumulative cash flow over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={cashFlowData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" label={{ value: 'Years', position: 'insideBottom', offset: -5 }} />
                      <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                      <RechartsTooltip formatter={(value: any) => `$${value.toLocaleString()}`} />
                      <Legend />
                      <Line type="monotone" dataKey="cashFlow" stroke="hsl(var(--primary))" name="Gross Cash Flow" strokeWidth={2} />
                      <Line type="monotone" dataKey="netIncome" stroke="hsl(var(--accent))" name="Net Income (After Tax)" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
