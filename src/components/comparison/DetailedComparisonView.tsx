import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { X, TrendingUp, DollarSign, Home, Bed, Bath, Square, MapPin, Calendar, Lock, Sparkles, Loader2 } from "lucide-react";
import { HomeLensListing } from "@/types/ui-blocks";
import { formatCurrency } from "@/lib/calculations";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface DetailedComparisonViewProps {
  properties: HomeLensListing[];
  onClose: () => void;
  onRemove: (propertyId: string) => void;
}

export function DetailedComparisonView({ properties, onClose, onRemove }: DetailedComparisonViewProps) {
  const { tier } = useSubscription();
  const isPro = tier === 'pro' || tier === 'premium';
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [buyerType, setBuyerType] = useState<string>('primary_residence');

  const calculateMonthlyPayment = (price: number) => {
    const downPayment = price * 0.20;
    const loanAmount = price - downPayment;
    const monthlyRate = 0.068 / 12; // 6.8% annual
    const numPayments = 30 * 12;
    const monthlyPI = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
    const propertyTax = (price * 0.012) / 12; // Estimate 1.2% annual
    const insurance = 150; // Estimate
    return monthlyPI + propertyTax + insurance;
  };

  const calculatePricePerSqft = (price: number | null, sqft: number | null) => {
    if (!price || !sqft) return null;
    return price / sqft;
  };

  const getInvestmentMetrics = (property: HomeLensListing) => {
    if (!property.price) return null;

    const rentEstimate = property.insights?.rentcast?.rent_estimate;
    const monthlyPayment = calculateMonthlyPayment(property.price);
    const downPayment = property.price * 0.20;

    if (rentEstimate && monthlyPayment) {
      const cashflow = rentEstimate - monthlyPayment;
      const annualCashflow = cashflow * 12;
      const cashOnCashReturn = (annualCashflow / downPayment) * 100;
      
      return {
        rentEstimate,
        monthlyPayment,
        cashflow,
        cashOnCashReturn,
        downPayment,
      };
    }

    return null;
  };

  const loadAIAnalysis = async () => {
    if (properties.length < 2) return;
    
    setLoadingAnalysis(true);
    try {
      const { data, error } = await supabase.functions.invoke('compare-properties-ai', {
        body: { properties }
      });

      if (error) throw error;

      if (data?.analysis) {
        setAiAnalysis(data.analysis);
        setBuyerType(data.buyerType || 'primary_residence');
      }
    } catch (error) {
      console.error('Error loading AI analysis:', error);
      toast.error('Failed to load AI analysis. Please try again.');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  useEffect(() => {
    loadAIAnalysis();
  }, [properties]);

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <Card className="shadow-2xl">
          <CardHeader>
            <div className="flex items-start justify-between mb-4">
              <div>
                <CardTitle className="text-2xl mb-2 flex items-center gap-2">
                  <TrendingUp className="h-6 w-6 text-primary" />
                  Property Comparison
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Side-by-side comparison of {properties.length} properties
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-semibold sticky left-0 bg-background z-10 min-w-[180px]">
                      Property Details
                    </th>
                    {properties.map((property) => (
                      <th key={property.id} className="p-4 min-w-[250px]">
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={() => onRemove(property.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <div className="aspect-video rounded-lg overflow-hidden mb-3 bg-muted">
                            {property.photoUrl ? (
                              <img
                                src={property.photoUrl}
                                alt={property.address}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Home className="h-12 w-12 text-muted-foreground/20" />
                              </div>
                            )}
                          </div>
                          <p className="text-xs font-medium truncate text-left">
                            {property.address}
                          </p>
                          <p className="text-xs text-muted-foreground text-left">
                            {property.city}, {property.state}
                          </p>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Price */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        List Price
                      </div>
                    </td>
                    {properties.map((property) => (
                      <td key={property.id} className="p-4 text-center">
                        <span className="font-bold text-lg text-primary">
                          {property.price ? formatCurrency(property.price) : 'N/A'}
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Price per sqft */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">Price per sqft</td>
                    {properties.map((property) => {
                      const pricePerSqft = calculatePricePerSqft(property.price, property.sqft);
                      return (
                        <td key={property.id} className="p-4 text-center text-sm">
                          {pricePerSqft ? `$${pricePerSqft.toFixed(0)}/sqft` : 'N/A'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Beds */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">
                      <div className="flex items-center gap-2">
                        <Bed className="h-4 w-4 text-muted-foreground" />
                        Bedrooms
                      </div>
                    </td>
                    {properties.map((property) => (
                      <td key={property.id} className="p-4 text-center text-sm">
                        {property.beds || 'N/A'}
                      </td>
                    ))}
                  </tr>

                  {/* Baths */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">
                      <div className="flex items-center gap-2">
                        <Bath className="h-4 w-4 text-muted-foreground" />
                        Bathrooms
                      </div>
                    </td>
                    {properties.map((property) => (
                      <td key={property.id} className="p-4 text-center text-sm">
                        {property.baths || 'N/A'}
                      </td>
                    ))}
                  </tr>

                  {/* Sqft */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">
                      <div className="flex items-center gap-2">
                        <Square className="h-4 w-4 text-muted-foreground" />
                        Square Feet
                      </div>
                    </td>
                    {properties.map((property) => (
                      <td key={property.id} className="p-4 text-center text-sm">
                        {property.sqft ? property.sqft.toLocaleString() : 'N/A'}
                      </td>
                    ))}
                  </tr>

                  {/* Separator */}
                  <tr>
                    <td colSpan={properties.length + 1} className="py-4">
                      <Separator />
                    </td>
                  </tr>

                  {/* Monthly Payment Estimate */}
                  <tr className="border-b hover:bg-muted/50 bg-muted/30">
                    <td className="p-4 font-medium sticky left-0 bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        Monthly Payment
                      </div>
                      <p className="text-xs text-muted-foreground font-normal">
                        20% down, 6.8% APR, 30yr
                      </p>
                    </td>
                    {properties.map((property) => {
                      const monthly = property.price ? calculateMonthlyPayment(property.price) : null;
                      return (
                        <td key={property.id} className="p-4 text-center">
                          <span className="font-semibold text-base">
                            {monthly ? formatCurrency(monthly) : 'N/A'}
                          </span>
                          <p className="text-xs text-muted-foreground">per month</p>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Down Payment */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">Down Payment (20%)</td>
                    {properties.map((property) => {
                      const downPayment = property.price ? property.price * 0.20 : null;
                      return (
                        <td key={property.id} className="p-4 text-center text-sm">
                          {downPayment ? formatCurrency(downPayment) : 'N/A'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Separator */}
                  <tr>
                    <td colSpan={properties.length + 1} className="py-4">
                      <Separator />
                    </td>
                  </tr>

                  {/* Investment Metrics Header */}
                  <tr className="bg-primary/5">
                    <td colSpan={properties.length + 1} className="p-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Investment Analysis
                        {!isPro && (
                          <Badge variant="secondary" className="ml-2">
                            <Lock className="h-3 w-3 mr-1" />
                            Pro Feature
                          </Badge>
                        )}
                      </h3>
                    </td>
                  </tr>

                  {/* Estimated Monthly Rent */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">
                      Est. Monthly Rent
                      <p className="text-xs text-muted-foreground font-normal">via RentCast</p>
                    </td>
                    {properties.map((property) => {
                      const metrics = getInvestmentMetrics(property);
                      return (
                        <td key={property.id} className="p-4 text-center">
                          {isPro ? (
                            metrics?.rentEstimate ? (
                              <span className="font-semibold text-sm">
                                {formatCurrency(metrics.rentEstimate)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">No data</span>
                            )
                          ) : (
                            <Lock className="h-4 w-4 mx-auto text-muted-foreground" />
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Monthly Cashflow */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">
                      Monthly Cash Flow
                      <p className="text-xs text-muted-foreground font-normal">Rent - Payment</p>
                    </td>
                    {properties.map((property) => {
                      const metrics = getInvestmentMetrics(property);
                      return (
                        <td key={property.id} className="p-4 text-center">
                          {isPro ? (
                            metrics?.cashflow ? (
                              <div className="flex flex-col items-center">
                                <span className={`font-semibold ${metrics.cashflow > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatCurrency(metrics.cashflow)}
                                </span>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs mt-1 ${
                                    metrics.cashflow > 0 
                                      ? 'bg-green-50 text-green-700 border-green-200' 
                                      : 'bg-red-50 text-red-700 border-red-200'
                                  }`}
                                >
                                  {metrics.cashflow > 0 ? 'Positive' : 'Negative'}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">No data</span>
                            )
                          ) : (
                            <Lock className="h-4 w-4 mx-auto text-muted-foreground" />
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Cash-on-Cash Return */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">
                      Cash-on-Cash Return
                      <p className="text-xs text-muted-foreground font-normal">Annual ROI on down payment</p>
                    </td>
                    {properties.map((property) => {
                      const metrics = getInvestmentMetrics(property);
                      return (
                        <td key={property.id} className="p-4 text-center">
                          {isPro ? (
                            metrics?.cashOnCashReturn ? (
                              <span className={`font-semibold ${metrics.cashOnCashReturn > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {metrics.cashOnCashReturn.toFixed(2)}%
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">No data</span>
                            )
                          ) : (
                            <Lock className="h-4 w-4 mx-auto text-muted-foreground" />
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Market Value Estimate */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">
                      Est. Market Value
                      <p className="text-xs text-muted-foreground font-normal">via RentCast</p>
                    </td>
                    {properties.map((property) => {
                      const estValue = property.insights?.rentcast?.value_estimate;
                      return (
                        <td key={property.id} className="p-4 text-center text-sm">
                          {isPro ? (
                            estValue ? formatCurrency(estValue) : <span className="text-muted-foreground">No data</span>
                          ) : (
                            <Lock className="h-4 w-4 mx-auto text-muted-foreground" />
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Separator */}
                  <tr>
                    <td colSpan={properties.length + 1} className="py-4">
                      <Separator />
                    </td>
                  </tr>

                  {/* Separator */}
                  <tr>
                    <td colSpan={properties.length + 1} className="py-4">
                      <Separator />
                    </td>
                  </tr>

                  {/* AI Analysis Section */}
                  <tr className="bg-gradient-to-r from-primary/10 to-primary/5">
                    <td colSpan={properties.length + 1} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold">AI Recommendation</h3>
                          <Badge variant="secondary" className="text-xs">
                            {buyerType === 'investor' ? 'Investment Focus' : 'Primary Residence'}
                          </Badge>
                        </div>
                        {!loadingAnalysis && aiAnalysis && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={loadAIAnalysis}
                          >
                            Refresh Analysis
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={properties.length + 1} className="p-6 bg-muted/30">
                      {loadingAnalysis ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                          <span className="text-sm text-muted-foreground">Analyzing properties...</span>
                        </div>
                      ) : aiAnalysis ? (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                          No AI analysis available. Please try refreshing.
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Separator */}
                  <tr>
                    <td colSpan={properties.length + 1} className="py-4">
                      <Separator />
                    </td>
                  </tr>

                  {/* Demographics Header */}
                  <tr className="bg-primary/5">
                    <td colSpan={properties.length + 1} className="p-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Area Demographics
                        {!isPro && (
                          <Badge variant="secondary" className="ml-2">
                            <Lock className="h-3 w-3 mr-1" />
                            Pro Feature
                          </Badge>
                        )}
                      </h3>
                    </td>
                  </tr>

                  {/* Median Household Income */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">
                      Median Household Income
                      <p className="text-xs text-muted-foreground font-normal">US Census data</p>
                    </td>
                    {properties.map((property) => {
                      const income = property.insights?.census?.median_household_income;
                      return (
                        <td key={property.id} className="p-4 text-center text-sm">
                          {isPro ? (
                            income ? formatCurrency(income) : <span className="text-muted-foreground">No data</span>
                          ) : (
                            <Lock className="h-4 w-4 mx-auto text-muted-foreground" />
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Homeownership Rate */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">Owner-Occupied Rate</td>
                    {properties.map((property) => {
                      const rate = property.insights?.census?.owner_occupied_rate;
                      return (
                        <td key={property.id} className="p-4 text-center text-sm">
                          {isPro ? (
                            rate ? `${(rate * 100).toFixed(1)}%` : <span className="text-muted-foreground">No data</span>
                          ) : (
                            <Lock className="h-4 w-4 mx-auto text-muted-foreground" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-between items-center mt-6 pt-6 border-t">
              <p className="text-sm text-muted-foreground">
                {!isPro && (
                  <>Upgrade to Pro to unlock full investment analysis and demographic data</>
                )}
              </p>
              <Button onClick={onClose}>Close Comparison</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
