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
// ... keep existing code - this is a large file, I'll selectively replace isPro with isPremium
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  X, 
  TrendingUp, 
  DollarSign, 
  Percent, 
  Home,
  MapPin,
  Lock,
  ChevronDown,
  ChevronUp,
  Calculator
} from "lucide-react";
import type { HomeLensListing } from "@/types/property";
import { useSubscription } from "@/hooks/useSubscription";
import { calculateInvestmentMetrics, formatCurrency } from "@/lib/calculations";

interface DetailedComparisonViewProps {
  properties: HomeLensListing[];
  onClose: () => void;
  onRemove: (propertyId: string) => void;
}

export function DetailedComparisonView({ properties, onClose, onRemove }: DetailedComparisonViewProps) {
  const { tier } = useSubscription();
  const isPremium = tier === 'premium';
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [buyerType, setBuyerType] = useState<string>('primary_residence');

  const calculateMonthlyPayment = (price: number) => {
    const downPayment = price * 0.20;
    const loanAmount = price - downPayment;
    const monthlyRate = 0.068 / 12; // 6.8% annual
    const numPayments = 30 * 12;
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
    return monthlyPayment;
  };

  const formatPrice = (price: number | null | undefined) => {
    if (!price) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(price);
  };

  const formatNumber = (num: number | null | undefined) => {
    if (!num) return '—';
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getPricePerSqft = (price: number, sqft: number) => {
    if (!sqft) return null;
    return Math.round(price / sqft);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-6xl max-h-[90vh] overflow-auto">
        <Card className="w-full">
          <CardHeader className="sticky top-0 bg-background z-10 border-b">
            <div className="flex items-center justify-between">
              <CardTitle>Property Comparison ({properties.length})</CardTitle>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="sticky top-[73px] bg-background z-10">
                  <tr className="border-b">
                    <th className="p-4 text-left font-semibold sticky left-0 bg-background min-w-[200px]">
                      Property
                    </th>
                    {properties.map((property) => (
                      <th key={property.id} className="p-4 text-center min-w-[180px]">
                        <div className="space-y-2">
                          {property.photoUrl ? (
                            <img 
                              src={property.photoUrl} 
                              alt={property.address}
                              className="w-full h-24 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-full h-24 bg-muted rounded-lg flex items-center justify-center">
                              <Home className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-sm line-clamp-2">{property.address}</p>
                            <p className="text-xs text-muted-foreground">{property.city}, {property.state}</p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive"
                            onClick={() => onRemove(property.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {/* Price */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        List Price
                      </div>
                    </td>
                    {properties.map((property) => (
                      <td key={property.id} className="p-4 text-center">
                        <span className="font-bold text-lg">{formatPrice(property.price)}</span>
                      </td>
                    ))}
                  </tr>

                  {/* Price per Sqft */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">
                      Price per Sqft
                    </td>
                    {properties.map((property) => (
                      <td key={property.id} className="p-4 text-center">
                        {getPricePerSqft(property.price, property.sqft) ? (
                          <span>${getPricePerSqft(property.price, property.sqft)}/sqft</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Beds */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">Bedrooms</td>
                    {properties.map((property) => (
                      <td key={property.id} className="p-4 text-center">
                        {property.beds || '—'}
                      </td>
                    ))}
                  </tr>

                  {/* Baths */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">Bathrooms</td>
                    {properties.map((property) => (
                      <td key={property.id} className="p-4 text-center">
                        {property.baths || '—'}
                      </td>
                    ))}
                  </tr>

                  {/* Sqft */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">Square Feet</td>
                    {properties.map((property) => (
                      <td key={property.id} className="p-4 text-center">
                        {property.sqft ? formatNumber(property.sqft) : '—'}
                      </td>
                    ))}
                  </tr>

                  {/* Year Built */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">Year Built</td>
                    {properties.map((property) => (
                      <td key={property.id} className="p-4 text-center">
                        {property.yearBuilt || '—'}
                      </td>
                    ))}
                  </tr>

                  {/* Status */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">Status</td>
                    {properties.map((property) => (
                      <td key={property.id} className="p-4 text-center">
                        <Badge variant={property.status === 'Active' ? 'default' : 'secondary'}>
                          {property.status || 'Unknown'}
                        </Badge>
                      </td>
                    ))}
                  </tr>

                  {/* Monthly Payment (20% down, 6.8%) */}
                  <tr className="border-b hover:bg-muted/50 bg-muted/30">
                    <td className="p-4 font-medium sticky left-0 bg-background">
                      <div className="flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        Est. Monthly Payment
                        <p className="text-xs text-muted-foreground font-normal">20% down, 6.8% APR</p>
                      </div>
                    </td>
                    {properties.map((property) => {
                      const monthlyPayment = calculateMonthlyPayment(property.price);
                      return (
                        <td key={property.id} className="p-4 text-center">
                          <span className="font-semibold text-primary">{formatCurrency(monthlyPayment)}</span>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Investment Analysis Section - Premium */}
                  <tr className="border-b bg-amber-50/50 dark:bg-amber-950/20">
                    <td colSpan={properties.length + 1} className="p-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Investment Analysis
                        {!isPremium && (
                          <Badge variant="secondary" className="ml-2">
                            <Lock className="h-3 w-3 mr-1" />
                            Premium Feature
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
                      const metrics = calculateInvestmentMetrics(property);
                      return (
                        <td key={property.id} className="p-4 text-center">
                          {isPremium ? (
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
                      Monthly Cashflow
                      <p className="text-xs text-muted-foreground font-normal">Rent - Mortgage - Expenses</p>
                    </td>
                    {properties.map((property) => {
                      const metrics = calculateInvestmentMetrics(property);
                      return (
                        <td key={property.id} className="p-4 text-center">
                          {isPremium ? (
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

                  {/* Cash on Cash Return */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">
                      Cash on Cash Return
                      <p className="text-xs text-muted-foreground font-normal">Annual cashflow / Down payment</p>
                    </td>
                    {properties.map((property) => {
                      const metrics = calculateInvestmentMetrics(property);
                      return (
                        <td key={property.id} className="p-4 text-center">
                          {isPremium ? (
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

                  {/* Est. Market Value */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">
                      Est. Market Value
                      <p className="text-xs text-muted-foreground font-normal">via RentCast AVM</p>
                    </td>
                    {properties.map((property) => {
                      const estValue = property.insights?.estValue;
                      return (
                        <td key={property.id} className="p-4 text-center text-sm">
                          {isPremium ? (
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
                    <td colSpan={properties.length + 1} className="h-4"></td>
                  </tr>

                  {/* AI Analysis Section */}
                  <tr className="border-b bg-primary/5">
                    <td colSpan={properties.length + 1} className="p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          AI-Powered Analysis
                        </h3>
                        {!isPremium && (
                          <Badge variant="secondary">
                            <Lock className="h-3 w-3 mr-1" />
                            Premium Feature
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* AI Comparison Analysis */}
                  {aiAnalysis && (
                    <tr className="border-b">
                      <td colSpan={properties.length + 1} className="p-4">
                        <div className="bg-muted/30 rounded-lg p-4">
                          <h4 className="font-medium mb-2">AI Investment Comparison</h4>
                          <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                            {aiAnalysis}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Demographics Section - Premium */}
                  <tr className="border-b bg-amber-50/50 dark:bg-amber-950/20">
                    <td colSpan={properties.length + 1} className="p-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Area Demographics
                        {!isPremium && (
                          <Badge variant="secondary" className="ml-2">
                            <Lock className="h-3 w-3 mr-1" />
                            Premium Feature
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
                          {isPremium ? (
                            income ? formatCurrency(income) : <span className="text-muted-foreground">No data</span>
                          ) : (
                            <Lock className="h-4 w-4 mx-auto text-muted-foreground" />
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Poverty Rate */}
                  <tr className="border-b hover:bg-muted/50">
                    <td className="p-4 font-medium sticky left-0 bg-background">
                      Poverty Rate
                      <p className="text-xs text-muted-foreground font-normal">% below poverty line</p>
                    </td>
                    {properties.map((property) => {
                      const rate = property.insights?.census?.poverty_rate;
                      return (
                        <td key={property.id} className="p-4 text-center text-sm">
                          {isPremium ? (
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
                {!isPremium && (
                  <>Upgrade to Premium to unlock full investment analysis and demographic data</>
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
