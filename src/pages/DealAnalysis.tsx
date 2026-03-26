import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/Navigation";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Calculator, 
  Download, 
  TrendingUp, 
  Home, 
  DollarSign,
  TrendingDown,
  Zap,
  Target,
  Info
} from "lucide-react";
import { 
  calculatePropertyScores, 
  getScoreColor, 
  getScoreDescription,
  type PropertyData 
} from "@/utils/propertyScoring";
import { StrategyPlaybook } from "@/components/StrategyPlaybook";
import { DataCitations } from "@/components/DataCitations";

export default function DealAnalysis() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Property inputs
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [sqft, setSqft] = useState("");
  const [hoa, setHoa] = useState("");
  const [taxes, setTaxes] = useState("");
  const [downPayment, setDownPayment] = useState("20");
  const [interestRate, setInterestRate] = useState("6.8");

  // Investor inputs
  const [arv, setArv] = useState("");
  const [rehabBudget, setRehabBudget] = useState("");

  // Load user profile on mount
  useState(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        
        setUserProfile(profile);
      }
    };
    loadProfile();
  });

  const calculateBuyerMetrics = () => {
    const homePrice = parseFloat(price);
    const downPct = parseFloat(downPayment) / 100;
    const rate = parseFloat(interestRate) / 100 / 12;
    const loanAmount = homePrice * (1 - downPct);
    const months = 360; // 30 year mortgage

    // Monthly P&I
    const pi = loanAmount * (rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1);
    
    // PMI (if down payment < 20%)
    const pmi = downPct < 0.2 ? (loanAmount * 0.005 / 12) : 0;
    
    // Monthly taxes and HOA
    const monthlyTaxes = parseFloat(taxes || "0") / 12;
    const monthlyHoa = parseFloat(hoa || "0");
    
    const totalMonthly = pi + pmi + monthlyTaxes + monthlyHoa;

    return {
      principalInterest: pi,
      pmi,
      monthlyTaxes,
      monthlyHoa,
      totalMonthly,
      downPaymentAmount: homePrice * downPct,
    };
  };

  const calculateInvestorMetrics = () => {
    const homePrice = parseFloat(price);
    const arvValue = parseFloat(arv || price);
    const rehab = parseFloat(rehabBudget || "0");
    const downPct = parseFloat(downPayment) / 100;
    
    // Max Offer Price (70% rule for flips)
    const maxOfferPrice = (arvValue * 0.7) - rehab;
    
    // Potential profit
    const totalCost = homePrice + rehab;
    const profit = arvValue - totalCost - (arvValue * 0.1); // 10% for holding costs
    
    // Cash on Cash (simplified)
    const downPaymentAmount = homePrice * downPct;
    const estimatedRent = homePrice * 0.01; // 1% rule estimate
    const buyerMetrics = calculateBuyerMetrics();
    const monthlyCashFlow = estimatedRent - buyerMetrics.totalMonthly;
    const annualCashFlow = monthlyCashFlow * 12;
    const cashOnCash = (annualCashFlow / downPaymentAmount) * 100;
    
    // Cap Rate
    const noi = annualCashFlow;
    const capRate = (noi / homePrice) * 100;

    return {
      arv: arvValue,
      rehab,
      maxOfferPrice,
      profit,
      profitMargin: ((profit / arvValue) * 100),
      estimatedRent,
      monthlyCashFlow,
      cashOnCash,
      capRate,
    };
  };

  const handleAnalyze = async () => {
    if (!price || !address) {
      toast({
        title: "Missing information",
        description: "Please provide at least an address and price.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const buyerMetrics = calculateBuyerMetrics();
      const investorMetrics = calculateInvestorMetrics();

      // Calculate property scores
      const propertyData: PropertyData = {
        price: parseFloat(price),
        sqft: parseInt(sqft || "2000"),
        beds: parseInt(beds || "3"),
        baths: parseFloat(baths || "2"),
        yearBuilt: 2015,
        taxes: parseFloat(taxes || "4500"),
        hoa: parseFloat(hoa || "0"),
        daysOnMarket: 30, // Default estimate
        arv: arv ? parseFloat(arv) : undefined,
        estimatedRent: investorMetrics.estimatedRent,
      };

      const scores = calculatePropertyScores(propertyData);

      const analysis = {
        property: {
          address,
          price: parseFloat(price),
          beds: parseInt(beds || "0"),
          baths: parseFloat(baths || "0"),
          sqft: parseInt(sqft || "0"),
          hoa: parseFloat(hoa || "0"),
          taxes: parseFloat(taxes || "0"),
        },
        buyer: buyerMetrics,
        investor: investorMetrics,
        scores,
        timestamp: new Date().toISOString(),
      };

      setAnalysisResult(analysis);

      // Save to database (analyses table requires property_id, so we'll skip for now)
      // This will be enhanced in Phase 2 when we integrate with actual property data
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // TODO: Save analysis when we have property_id
        // TODO: Save analysis when we have property_id
      }

      toast({
        title: "Analysis complete!",
        description: "Your deal analysis is ready with market insights.",
      });
    } catch (error) {
      console.error("Analysis error:", error);
      toast({
        title: "Error",
        description: "Failed to analyze the deal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto py-8 px-4 pt-24">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Deal Analysis 📊</h1>
            <p className="text-muted-foreground">
              Analyze any property investment opportunity
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/")}>
            Back to Home
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Property Details
              </CardTitle>
              <CardDescription>
                Enter the property information to analyze
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Property Address</Label>
                <Input
                  id="address"
                  placeholder="123 Main St, Arlington, VA"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Purchase Price</Label>
                  <Input
                    id="price"
                    type="number"
                    placeholder="450000"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sqft">Square Feet</Label>
                  <Input
                    id="sqft"
                    type="number"
                    placeholder="2000"
                    value={sqft}
                    onChange={(e) => setSqft(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="beds">Bedrooms</Label>
                  <Input
                    id="beds"
                    type="number"
                    placeholder="3"
                    value={beds}
                    onChange={(e) => setBeds(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="baths">Bathrooms</Label>
                  <Input
                    id="baths"
                    type="number"
                    step="0.5"
                    placeholder="2.5"
                    value={baths}
                    onChange={(e) => setBaths(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="taxes">Annual Taxes</Label>
                  <Input
                    id="taxes"
                    type="number"
                    placeholder="4500"
                    value={taxes}
                    onChange={(e) => setTaxes(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hoa">Monthly HOA</Label>
                  <Input
                    id="hoa"
                    type="number"
                    placeholder="150"
                    value={hoa}
                    onChange={(e) => setHoa(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="down">Down Payment %</Label>
                  <Input
                    id="down"
                    type="number"
                    placeholder="20"
                    value={downPayment}
                    onChange={(e) => setDownPayment(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate">Interest Rate %</Label>
                  <Input
                    id="rate"
                    type="number"
                    step="0.1"
                    placeholder="6.8"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-3">Investor Details (Optional)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="arv">ARV (After Repair Value)</Label>
                    <Input
                      id="arv"
                      type="number"
                      placeholder="550000"
                      value={arv}
                      onChange={(e) => setArv(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rehab">Rehab Budget</Label>
                    <Input
                      id="rehab"
                      type="number"
                      placeholder="50000"
                      value={rehabBudget}
                      onChange={(e) => setRehabBudget(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Button
                onClick={handleAnalyze}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? "Analyzing..." : "Analyze Deal"}
              </Button>
            </CardContent>
          </Card>

          {/* Results Section */}
          <div className="space-y-4">
            {analysisResult ? (
              <>
                {/* Market Intelligence Scores */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Market Intelligence Scores
                    </CardTitle>
                    <CardDescription>
                      AI-powered analysis of this property's investment potential
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <TooltipProvider>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Equity Growth Score */}
                        <div className="p-4 border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">Equity Growth</span>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">{getScoreDescription("equityGrowth")}</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <Badge variant={getScoreColor(analysisResult.scores.equityGrowth).badge as any}>
                              {analysisResult.scores.equityGrowth}
                            </Badge>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                analysisResult.scores.equityGrowth >= 80
                                  ? "bg-green-600"
                                  : analysisResult.scores.equityGrowth >= 50
                                  ? "bg-yellow-600"
                                  : "bg-red-600"
                              }`}
                              style={{ width: `${analysisResult.scores.equityGrowth}%` }}
                            />
                          </div>
                          <p className={`text-xs ${getScoreColor(analysisResult.scores.equityGrowth).color}`}>
                            {getScoreColor(analysisResult.scores.equityGrowth).label}
                          </p>
                        </div>

                        {/* Neighborhood Momentum */}
                        <div className="p-4 border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Zap className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">Market Momentum</span>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">{getScoreDescription("neighborhoodMomentum")}</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <Badge variant={getScoreColor(analysisResult.scores.neighborhoodMomentum).badge as any}>
                              {analysisResult.scores.neighborhoodMomentum}
                            </Badge>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                analysisResult.scores.neighborhoodMomentum >= 80
                                  ? "bg-green-600"
                                  : analysisResult.scores.neighborhoodMomentum >= 50
                                  ? "bg-yellow-600"
                                  : "bg-red-600"
                              }`}
                              style={{ width: `${analysisResult.scores.neighborhoodMomentum}%` }}
                            />
                          </div>
                          <p className={`text-xs ${getScoreColor(analysisResult.scores.neighborhoodMomentum).color}`}>
                            {getScoreColor(analysisResult.scores.neighborhoodMomentum).label}
                          </p>
                        </div>

                        {/* Liquidity Risk */}
                        <div className="p-4 border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <TrendingDown className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">Liquidity Risk</span>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">{getScoreDescription("liquidityRisk")}</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <Badge variant={getScoreColor(analysisResult.scores.liquidityRisk).badge as any}>
                              {analysisResult.scores.liquidityRisk}
                            </Badge>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                analysisResult.scores.liquidityRisk >= 80
                                  ? "bg-green-600"
                                  : analysisResult.scores.liquidityRisk >= 50
                                  ? "bg-yellow-600"
                                  : "bg-red-600"
                              }`}
                              style={{ width: `${analysisResult.scores.liquidityRisk}%` }}
                            />
                          </div>
                          <p className={`text-xs ${getScoreColor(analysisResult.scores.liquidityRisk).color}`}>
                            {getScoreColor(analysisResult.scores.liquidityRisk).label}
                          </p>
                        </div>

                        {/* Rentability Score */}
                        <div className="p-4 border rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Home className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">Rentability</span>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs">{getScoreDescription("rentability")}</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <Badge variant={getScoreColor(analysisResult.scores.rentability).badge as any}>
                              {analysisResult.scores.rentability}
                            </Badge>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                analysisResult.scores.rentability >= 80
                                  ? "bg-green-600"
                                  : analysisResult.scores.rentability >= 50
                                  ? "bg-yellow-600"
                                  : "bg-red-600"
                              }`}
                              style={{ width: `${analysisResult.scores.rentability}%` }}
                            />
                          </div>
                          <p className={`text-xs ${getScoreColor(analysisResult.scores.rentability).color}`}>
                            {getScoreColor(analysisResult.scores.rentability).label}
                          </p>
                        </div>
                      </div>
                    </TooltipProvider>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Analysis Results</CardTitle>
                    <CardDescription>{analysisResult.property.address}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="buyer">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="buyer">
                          <Home className="h-4 w-4 mr-2" />
                          Buyer
                        </TabsTrigger>
                        <TabsTrigger value="investor">
                          <TrendingUp className="h-4 w-4 mr-2" />
                          Investor
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="buyer" className="space-y-4">
                        <div className="grid gap-4">
                          <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                            <span className="text-sm">Principal & Interest</span>
                            <span className="font-semibold">
                              {formatCurrency(analysisResult.buyer.principalInterest)}
                            </span>
                          </div>
                          {analysisResult.buyer.pmi > 0 && (
                            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                              <span className="text-sm">PMI</span>
                              <span className="font-semibold">
                                {formatCurrency(analysisResult.buyer.pmi)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                            <span className="text-sm">Property Taxes (monthly)</span>
                            <span className="font-semibold">
                              {formatCurrency(analysisResult.buyer.monthlyTaxes)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                            <span className="text-sm">HOA</span>
                            <span className="font-semibold">
                              {formatCurrency(analysisResult.buyer.monthlyHoa)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg border-2 border-primary">
                            <span className="font-semibold">Total Monthly Payment</span>
                            <span className="text-xl font-bold">
                              {formatCurrency(analysisResult.buyer.totalMonthly)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                            <span className="text-sm">Down Payment Required</span>
                            <span className="font-semibold">
                              {formatCurrency(analysisResult.buyer.downPaymentAmount)}
                            </span>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="investor" className="space-y-4">
                        <div className="grid gap-4">
                          <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                            <span className="text-sm">ARV</span>
                            <span className="font-semibold">
                              {formatCurrency(analysisResult.investor.arv)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                            <span className="text-sm">Rehab Budget</span>
                            <span className="font-semibold">
                              {formatCurrency(analysisResult.investor.rehab)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg border-2 border-primary">
                            <span className="font-semibold">Max Offer Price (70% Rule)</span>
                            <span className="text-xl font-bold">
                              {formatCurrency(analysisResult.investor.maxOfferPrice)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                            <span className="text-sm">Estimated Profit</span>
                            <span className="font-semibold text-green-600">
                              {formatCurrency(analysisResult.investor.profit)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                            <span className="text-sm">Profit Margin</span>
                            <Badge variant="default">
                              {analysisResult.investor.profitMargin.toFixed(1)}%
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                            <span className="text-sm">Cap Rate</span>
                            <Badge variant="secondary">
                              {analysisResult.investor.capRate.toFixed(2)}%
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                            <span className="text-sm">Cash-on-Cash Return</span>
                            <Badge variant="secondary">
                              {analysisResult.investor.cashOnCash.toFixed(2)}%
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                            <span className="text-sm">Monthly Cash Flow</span>
                            <span className="font-semibold">
                              {formatCurrency(analysisResult.investor.monthlyCashFlow)}
                            </span>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                <Button variant="outline" className="w-full" size="lg">
                  <Download className="h-4 w-4 mr-2" />
                  Download Deal Report (Coming Soon)
                </Button>

                {/* Strategy Playbook */}
                {userProfile && (
                  <StrategyPlaybook
                    buyerType={userProfile.buyer_type || "regular-buyer"}
                    propertyData={{
                      price: parseFloat(price),
                      beds: parseInt(beds || "3"),
                      baths: parseFloat(baths || "2"),
                      sqft: parseInt(sqft || "2000"),
                      arv: arv ? parseFloat(arv) : undefined,
                      rehab: rehabBudget ? parseFloat(rehabBudget) : undefined,
                      estimatedRent: analysisResult.investor.estimatedRent,
                    }}
                  />
                )}

                {/* Data Citations */}
                <DataCitations
                  dataSources={[
                    {
                      field: "Purchase Price",
                      value: parseFloat(price),
                      source: "user-input",
                      confidence: "high",
                      lastUpdated: new Date().toLocaleDateString(),
                    },
                    {
                      field: "Monthly Payment (P&I)",
                      value: analysisResult.buyer.principalInterest,
                      source: "calculated",
                      confidence: "high",
                      methodology: "Standard mortgage formula with provided rate and term",
                      lastUpdated: new Date().toLocaleDateString(),
                    },
                    {
                      field: "Estimated Rent",
                      value: analysisResult.investor.estimatedRent,
                      source: "estimated",
                      confidence: "medium",
                      methodology: "Based on 1% rule (1% of purchase price per month)",
                      lastUpdated: new Date().toLocaleDateString(),
                    },
                    {
                      field: "ARV (After Repair Value)",
                      value: arv ? parseFloat(arv) : parseFloat(price) * 1.15,
                      source: arv ? "user-input" : "estimated",
                      confidence: arv ? "high" : "medium",
                      methodology: arv ? "User provided" : "Estimated at 115% of purchase price",
                      lastUpdated: new Date().toLocaleDateString(),
                    },
                    {
                      field: "Cap Rate",
                      value: `${analysisResult.investor.capRate.toFixed(2)}%`,
                      source: "calculated",
                      confidence: "medium",
                      methodology: "Net Operating Income / Property Value × 100",
                      lastUpdated: new Date().toLocaleDateString(),
                    },
                    {
                      field: "Equity Growth Score",
                      value: analysisResult.scores.equityGrowth,
                      source: "calculated",
                      confidence: "medium",
                      methodology: "Proprietary algorithm based on price/sqft, ARV, taxes, and property age",
                      lastUpdated: new Date().toLocaleDateString(),
                    },
                  ]}
                />
              </>
            ) : (
              <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center py-12">
                  <DollarSign className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Ready to Analyze</h3>
                  <p className="text-muted-foreground">
                    Enter property details to see your analysis results
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
