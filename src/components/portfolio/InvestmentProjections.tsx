import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, DollarSign, Home, Sparkles, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { UpgradeModal } from "@/components/subscription/UpgradeModal";
import type { PortfolioProperty } from "@/pages/Portfolio";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts";

interface InvestmentProjectionsProps {
  portfolioProperty: PortfolioProperty;
}

interface ProjectionData {
  year: number;
  propertyValue: number;
  equityPosition: number;
  annualCashFlow: number;
  cumulativeCashFlow: number;
  totalROI: number;
}

interface ProjectionsResponse {
  projections: ProjectionData[];
  assumptions: {
    appreciationRate: number;
    rentGrowthRate: number;
    vacancyRate: number;
    expenseGrowthRate: number;
  };
  summary: {
    totalAppreciation: number;
    totalEquityGain: number;
    totalCashFlow: number;
    finalROI: number;
    averageAnnualReturn: number;
  };
}

export function InvestmentProjections({ portfolioProperty }: InvestmentProjectionsProps) {
  const { toast } = useToast();
  const { isPremium } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [projections, setProjections] = useState<ProjectionsResponse | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [years, setYears] = useState(20);

  const generateProjections = async () => {
    if (!isPremium) {
      setShowUpgrade(true);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('investment-projections', {
        body: {
          property: portfolioProperty.property,
          portfolioData: {
            purchase_price: portfolioProperty.purchase_price,
            down_payment_pct: portfolioProperty.down_payment_pct,
            interest_rate_pct: portfolioProperty.interest_rate_pct,
            loan_term_years: portfolioProperty.loan_term_years,
            monthly_rent: portfolioProperty.monthly_rent,
            monthly_expenses: portfolioProperty.monthly_expenses,
          },
          years
        }
      });

      if (error) throw error;
      setProjections(data);
      
      toast({
        title: "Projections Generated",
        description: `${years}-year investment projections ready`
      });
    } catch (error: any) {
      console.error('Error generating projections:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate projections",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Long-Term Investment Projections
              </CardTitle>
              <CardDescription>
                AI-powered 10-20 year forecasts for this property
              </CardDescription>
            </div>
            <Badge variant="secondary">Premium</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!projections ? (
            <div className="text-center py-8">
              <div className="flex gap-2 justify-center mb-4">
                <Button
                  variant={years === 10 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setYears(10)}
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  10 Years
                </Button>
                <Button
                  variant={years === 20 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setYears(20)}
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  20 Years
                </Button>
              </div>
              <Button onClick={generateProjections} disabled={loading}>
                {loading ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
                    Generating Projections...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate {years}-Year Projections
                  </>
                )}
              </Button>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="text-sm text-muted-foreground mb-1">Total Appreciation</div>
                  <div className="text-xl font-bold text-green-600">
                    {formatCurrency(projections.summary.totalAppreciation)}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-muted-foreground mb-1">Equity Gain</div>
                  <div className="text-xl font-bold text-blue-600">
                    {formatCurrency(projections.summary.totalEquityGain)}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-muted-foreground mb-1">Total Cash Flow</div>
                  <div className="text-xl font-bold text-purple-600">
                    {formatCurrency(projections.summary.totalCashFlow)}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-muted-foreground mb-1">Final ROI</div>
                  <div className="text-xl font-bold text-primary">
                    {formatPercent(projections.summary.finalROI)}
                  </div>
                </Card>
              </div>

              {/* Charts */}
              <Tabs defaultValue="value" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="value">Property Value</TabsTrigger>
                  <TabsTrigger value="equity">Equity Growth</TabsTrigger>
                  <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
                </TabsList>

                <TabsContent value="value" className="space-y-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={projections.projections}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottom', offset: -5 }} />
                      <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="propertyValue"
                        name="Property Value"
                        stroke="#10b981"
                        fill="#10b98120"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </TabsContent>

                <TabsContent value="equity" className="space-y-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={projections.projections}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottom', offset: -5 }} />
                      <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="equityPosition"
                        name="Equity"
                        stroke="#3b82f6"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </TabsContent>

                <TabsContent value="cashflow" className="space-y-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={projections.projections}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" label={{ value: 'Year', position: 'insideBottom', offset: -5 }} />
                      <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="cumulativeCashFlow"
                        name="Cumulative Cash Flow"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </TabsContent>
              </Tabs>

              {/* Assumptions */}
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-sm">Projection Assumptions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Annual Appreciation: {formatPercent(projections.assumptions.appreciationRate)}</div>
                    <div>Rent Growth: {formatPercent(projections.assumptions.rentGrowthRate)}</div>
                    <div>Vacancy Rate: {formatPercent(projections.assumptions.vacancyRate)}</div>
                    <div>Expense Growth: {formatPercent(projections.assumptions.expenseGrowthRate)}</div>
                  </div>
                </CardContent>
              </Card>

              <Button
                variant="outline"
                onClick={() => setProjections(null)}
                className="w-full"
              >
                Generate New Projections
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason="Deep Investment Projections is a Premium feature"
        feature="10-20 year property appreciation, equity growth, and cash flow forecasts"
      />
    </>
  );
}
