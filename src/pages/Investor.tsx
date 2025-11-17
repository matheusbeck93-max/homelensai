import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, Calendar, TrendingUp, DollarSign } from "lucide-react";

export default function Investor() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Investment Calculator State
  const [propertyPrice, setPropertyPrice] = useState(0);
  const [downPayment, setDownPayment] = useState(0);
  const [interestRate, setInterestRate] = useState(7.0);
  const [loanTerm, setLoanTerm] = useState(30);
  const [monthlyRent, setMonthlyRent] = useState(0);
  const [propertyTaxes, setPropertyTaxes] = useState(0);
  const [insurance, setInsurance] = useState(0);
  const [hoa, setHoa] = useState(0);
  const [maintenance, setMaintenance] = useState(0);
  const [vacancy, setVacancy] = useState(5);
  const [appreciation, setAppreciation] = useState(3);
  
  // Results State
  const [results, setResults] = useState<any>(null);
  const [insights, setInsights] = useState<string>("");
  const [insightsLoading, setInsightsLoading] = useState(false);

  // News Feed State
  const [newsArticles, setNewsArticles] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth?redirect=/investor");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth?redirect=/investor");
      }
    });

    // Load sample news (in production, this would come from an API)
    loadNewsArticles();

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadNewsArticles = () => {
    // Sample news data - in production, integrate with real estate news API
    setNewsArticles([
      {
        id: 1,
        title: "Fed Signals Potential Rate Cuts in 2024",
        source: "Real Estate News",
        date: "2024-11-14",
        summary: "Federal Reserve hints at possible interest rate reductions, potentially impacting mortgage rates and investment strategies.",
        link: "#"
      },
      {
        id: 2,
        title: "Multi-Family Properties See Strong Demand",
        source: "Investment Weekly",
        date: "2024-11-13",
        summary: "Multi-family real estate investments continue to outperform in major metropolitan areas with strong rental demand.",
        link: "#"
      },
      {
        id: 3,
        title: "Tech Hub Cities Lead in Property Appreciation",
        source: "Market Insights",
        date: "2024-11-12",
        summary: "Cities with growing tech sectors show highest appreciation rates, attracting real estate investors nationwide.",
        link: "#"
      }
    ]);
  };

  const calculateInvestment = () => {
    setLoading(true);
    
    try {
      // Basic calculations
      const loanAmount = propertyPrice - downPayment;
      const monthlyInterestRate = interestRate / 100 / 12;
      const numberOfPayments = loanTerm * 12;
      
      // Monthly mortgage payment (P&I)
      const monthlyMortgage = loanAmount * 
        (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, numberOfPayments)) /
        (Math.pow(1 + monthlyInterestRate, numberOfPayments) - 1);
      
      // Monthly expenses
      const monthlyTaxes = propertyTaxes / 12;
      const monthlyInsurance = insurance / 12;
      const monthlyHoa = hoa;
      const monthlyMaintenance = maintenance;
      const monthlyVacancy = (monthlyRent * vacancy) / 100;
      
      const totalMonthlyExpenses = monthlyMortgage + monthlyTaxes + monthlyInsurance + monthlyHoa + monthlyMaintenance + monthlyVacancy;
      
      // Cash flow
      const monthlyCashFlow = monthlyRent - totalMonthlyExpenses;
      const annualCashFlow = monthlyCashFlow * 12;
      
      // ROI calculations
      const totalInvestment = downPayment;
      const cashOnCashReturn = totalInvestment > 0 ? (annualCashFlow / totalInvestment) * 100 : 0;
      
      // Cap rate
      const noi = (monthlyRent * 12) - ((monthlyTaxes + monthlyInsurance + monthlyHoa + monthlyMaintenance + monthlyVacancy) * 12);
      const capRate = propertyPrice > 0 ? (noi / propertyPrice) * 100 : 0;
      
      // Projected values
      const projectedValue5Year = propertyPrice * Math.pow(1 + appreciation / 100, 5);
      const projectedEquity5Year = projectedValue5Year - loanAmount;
      
      setResults({
        loanAmount,
        monthlyMortgage,
        totalMonthlyExpenses,
        monthlyCashFlow,
        annualCashFlow,
        cashOnCashReturn,
        capRate,
        projectedValue5Year,
        projectedEquity5Year
      });
      
      toast({
        title: "Calculation Complete",
        description: "Investment analysis has been generated.",
      });
    } catch (error) {
      toast({
        title: "Calculation Error",
        description: "Please check your inputs and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = async () => {
    if (!results) {
      toast({
        title: "Calculate First",
        description: "Please calculate your investment before generating insights.",
        variant: "destructive",
      });
      return;
    }

    setInsightsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('calculator-insights', {
        body: {
          financialSummary: {
            propertyPrice,
            downPaymentAmount: downPayment,
            loanAmount: results.loanAmount,
            monthlyMortgage: results.monthlyMortgage,
            totalMonthlyCost: results.totalMonthlyExpenses,
            monthlyCashFlow: results.monthlyCashFlow,
            annualROI: results.cashOnCashReturn,
            capRate: results.capRate
          },
          buyingPower: {
            propertyType: "Investment Property",
            propertyLocation: "US Market"
          }
        }
      });

      if (error) throw error;

      setInsights(data.insights);
      
      toast({
        title: "Insights Generated",
        description: "AI investment analysis is ready.",
      });
    } catch (error) {
      console.error('Error generating insights:', error);
      toast({
        title: "Error",
        description: "Failed to generate insights. Please try again.",
        variant: "destructive",
      });
    } finally {
      setInsightsLoading(false);
    }
  };

  const startChatWithInsight = () => {
    if (!insights) return;
    
    navigate('/chat', {
      state: {
        initialMessage: `I'd like to discuss this investment analysis:\n\n${insights}`,
        skipAuthCheck: true,
        newConversation: false
      }
    });
  };

  const resetCalculator = () => {
    setPropertyPrice(0);
    setDownPayment(0);
    setInterestRate(7.0);
    setLoanTerm(30);
    setMonthlyRent(0);
    setPropertyTaxes(0);
    setInsurance(0);
    setHoa(0);
    setMaintenance(0);
    setVacancy(5);
    setAppreciation(3);
    setResults(null);
    setInsights("");
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 pt-24 pb-24 md:pb-16">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">HomeLens Investor</h1>
            <p className="text-muted-foreground text-lg">
              Analyze investment opportunities with AI-powered insights
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-8">
            {/* Investment Calculator */}
            <Card>
              <CardHeader>
                <CardTitle>Investment Calculator</CardTitle>
                <CardDescription>Enter your property investment details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Property Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Property Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="propertyPrice">Property Price</Label>
                      <Input
                        id="propertyPrice"
                        type="number"
                        value={propertyPrice || ""}
                        onChange={(e) => setPropertyPrice(Number(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="downPayment">Down Payment</Label>
                      <Input
                        id="downPayment"
                        type="number"
                        value={downPayment || ""}
                        onChange={(e) => setDownPayment(Number(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Financing */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Financing</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="interestRate">Interest Rate (%)</Label>
                      <Input
                        id="interestRate"
                        type="number"
                        step="0.1"
                        value={interestRate}
                        onChange={(e) => setInterestRate(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="loanTerm">Loan Term (years)</Label>
                      <Input
                        id="loanTerm"
                        type="number"
                        value={loanTerm}
                        onChange={(e) => setLoanTerm(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                {/* Income & Expenses */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Income & Expenses</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="monthlyRent">Monthly Rent</Label>
                      <Input
                        id="monthlyRent"
                        type="number"
                        value={monthlyRent || ""}
                        onChange={(e) => setMonthlyRent(Number(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="propertyTaxes">Annual Property Taxes</Label>
                      <Input
                        id="propertyTaxes"
                        type="number"
                        value={propertyTaxes || ""}
                        onChange={(e) => setPropertyTaxes(Number(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="insurance">Annual Insurance</Label>
                      <Input
                        id="insurance"
                        type="number"
                        value={insurance || ""}
                        onChange={(e) => setInsurance(Number(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="hoa">Monthly HOA</Label>
                      <Input
                        id="hoa"
                        type="number"
                        value={hoa || ""}
                        onChange={(e) => setHoa(Number(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="maintenance">Monthly Maintenance</Label>
                      <Input
                        id="maintenance"
                        type="number"
                        value={maintenance || ""}
                        onChange={(e) => setMaintenance(Number(e.target.value))}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="vacancy">Vacancy Rate (%)</Label>
                      <Input
                        id="vacancy"
                        type="number"
                        step="0.1"
                        value={vacancy}
                        onChange={(e) => setVacancy(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                {/* Projections */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Projections</h3>
                  <div>
                    <Label htmlFor="appreciation">Annual Appreciation (%)</Label>
                    <Input
                      id="appreciation"
                      type="number"
                      step="0.1"
                      value={appreciation}
                      onChange={(e) => setAppreciation(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={calculateInvestment} disabled={loading} className="flex-1">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Calculate Investment
                  </Button>
                  <Button onClick={resetCalculator} variant="outline">
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Results & AI Insights */}
            <div className="space-y-8">
              {/* Investment Summary */}
              {results && (
                <Card>
                  <CardHeader>
                    <CardTitle>Investment Summary</CardTitle>
                    <CardDescription>Your investment analysis results</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Monthly Cash Flow</p>
                        <p className={`text-2xl font-bold ${results.monthlyCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${results.monthlyCashFlow.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Cash-on-Cash Return</p>
                        <p className="text-2xl font-bold">{results.cashOnCashReturn.toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Cap Rate</p>
                        <p className="text-2xl font-bold">{results.capRate.toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Annual Cash Flow</p>
                        <p className={`text-2xl font-bold ${results.annualCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${results.annualCashFlow.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="border-t pt-4 space-y-2">
                      <h4 className="font-semibold">5-Year Projections</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Projected Value</p>
                          <p className="text-lg font-semibold">${results.projectedValue5Year.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Projected Equity</p>
                          <p className="text-lg font-semibold">${results.projectedEquity5Year.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* AI Insights */}
              <Card>
                <CardHeader>
                  <CardTitle>AI Investment Insights</CardTitle>
                  <CardDescription>Expert analysis of your investment opportunity</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {insights ? (
                    <>
                      <div className="prose prose-sm max-w-none">
                        {insights.split('\n').map((line, i) => (
                          <p key={i} className="mb-2">{line}</p>
                        ))}
                      </div>
                      <Button onClick={startChatWithInsight} className="w-full">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Start Chat with this Insight
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        Calculate your investment to generate AI-powered insights
                      </p>
                      <Button 
                        onClick={generateInsights} 
                        disabled={!results || insightsLoading}
                      >
                        {insightsLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Generate AI Insights
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Real Estate News Feed */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Real Estate Market News
              </CardTitle>
              <CardDescription>Stay informed with the latest market trends</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {newsArticles.map((article) => (
                  <div key={article.id} className="border-b pb-4 last:border-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2">{article.title}</h3>
                        <p className="text-muted-foreground text-sm mb-2">{article.summary}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {article.date}
                          </span>
                          <span>{article.source}</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a href={article.link} target="_blank" rel="noopener noreferrer">
                          Read More
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
