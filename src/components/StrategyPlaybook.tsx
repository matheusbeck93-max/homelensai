import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, TrendingUp, DollarSign, Home, AlertCircle, CheckCircle } from "lucide-react";

interface StrategyPlaybookProps {
  buyerType: string;
  propertyData: {
    price: number;
    beds: number;
    baths: number;
    sqft: number;
    arv?: number;
    rehab?: number;
    estimatedRent?: number;
  };
}

export function StrategyPlaybook({ buyerType, propertyData }: StrategyPlaybookProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  // First-Time Buyer Playbook
  if (buyerType === "first-time-buyer") {
    const estimatedClosingCosts = propertyData.price * 0.03; // 3% estimate
    const minDownPayment = propertyData.price * 0.035; // FHA 3.5%
    const conventionalDownPayment = propertyData.price * 0.20;

    return (
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
            <Home className="h-5 w-5" />
            First-Time Buyer Strategy
          </CardTitle>
          <CardDescription>Personalized guidance for your first home purchase</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Financing Options */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4" />
              Financing Options
            </h3>
            <div className="space-y-2">
              <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <Badge variant="default" className="mb-1">Recommended</Badge>
                    <p className="font-medium text-sm">FHA Loan (3.5% down)</p>
                  </div>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(minDownPayment)}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Lower credit score requirements (580+), easier qualification
                </p>
              </div>

              <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-sm">Conventional Loan (20% down)</p>
                  </div>
                  <p className="text-lg font-bold">{formatCurrency(conventionalDownPayment)}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  No PMI, better rates, requires 620+ credit score
                </p>
              </div>
            </div>
          </div>

          {/* Estimated Costs */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Estimated Closing Costs:</strong> {formatCurrency(estimatedClosingCosts)} (2-5% of purchase price)
              <br />
              Includes: Appraisal, inspection, title insurance, origination fees, prepaid taxes
            </AlertDescription>
          </Alert>

          {/* Action Steps */}
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4" />
              Next Steps
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                <p>Get pre-approved for a mortgage (takes 1-3 days)</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                <p>Check your credit score - aim for 620+ for conventional, 580+ for FHA</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                <p>Research first-time buyer assistance programs in your state</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold flex-shrink-0">4</div>
                <p>Budget for moving costs and immediate repairs (~$3,000-$5,000)</p>
              </div>
            </div>
          </div>

          {/* Pro Tip */}
          <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
            <Lightbulb className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm">
              <strong>Pro Tip:</strong> Lock in your interest rate as soon as you're pre-approved. 
              Rates can change daily, and a lock protects you for 30-60 days while you house hunt.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Investor Playbook
  if (buyerType === "investor") {
    const arv = propertyData.arv || propertyData.price * 1.15;
    const rehab = propertyData.rehab || 0;
    const estimatedRent = propertyData.estimatedRent || propertyData.price * 0.01;
    const monthlyOperatingExpenses = (propertyData.price * 0.01 * 0.5); // 50% rule
    const monthlyCashFlow = estimatedRent - monthlyOperatingExpenses;
    const annualCashFlow = monthlyCashFlow * 12;
    const flipProfit = arv - propertyData.price - rehab - (arv * 0.10); // 10% holding/selling costs

    // Determine strategy recommendation
    const cashFlowStrong = monthlyCashFlow > 200;
    const flipProfitStrong = flipProfit > propertyData.price * 0.15;
    
    let recommendedStrategy = "Hold & Rent";
    if (flipProfitStrong && !cashFlowStrong) {
      recommendedStrategy = "Flip";
    } else if (flipProfitStrong && cashFlowStrong) {
      recommendedStrategy = "BRRRR (Buy, Rehab, Rent, Refinance, Repeat)";
    }

    return (
      <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-100">
            <TrendingUp className="h-5 w-5" />
            Investor Strategy Analysis
          </CardTitle>
          <CardDescription>Data-driven recommendations for maximum ROI</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recommended Strategy */}
          <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border-2 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-lg">Recommended Strategy</h3>
              <Badge variant="default" className="text-base px-3 py-1">
                {recommendedStrategy}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {recommendedStrategy === "Flip" && "Quick profit potential with strong ARV spread. Exit in 4-6 months."}
              {recommendedStrategy === "Hold & Rent" && "Stable cash flow with long-term appreciation potential."}
              {recommendedStrategy === "BRRRR (Buy, Rehab, Rent, Refinance, Repeat)" && "Best of both: Build equity through renovation, then hold for cash flow."}
            </p>
          </div>

          {/* Flip Analysis */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4" />
              Flip Scenario
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 bg-muted rounded">
                <p className="text-xs text-muted-foreground">Purchase Price</p>
                <p className="font-semibold">{formatCurrency(propertyData.price)}</p>
              </div>
              <div className="p-2 bg-muted rounded">
                <p className="text-xs text-muted-foreground">Rehab Budget</p>
                <p className="font-semibold">{formatCurrency(rehab)}</p>
              </div>
              <div className="p-2 bg-muted rounded">
                <p className="text-xs text-muted-foreground">After Repair Value</p>
                <p className="font-semibold">{formatCurrency(arv)}</p>
              </div>
              <div className="p-2 bg-green-100 dark:bg-green-950 rounded">
                <p className="text-xs text-muted-foreground">Potential Profit</p>
                <p className="font-semibold text-green-600">{formatCurrency(flipProfit)}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Margin: {((flipProfit / arv) * 100).toFixed(1)}% 
              {flipProfit > propertyData.price * 0.15 ? " ✅ Strong flip opportunity" : " ⚠️ Tight margins"}
            </p>
          </div>

          {/* Hold & Rent Analysis */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <Home className="h-4 w-4" />
              Hold & Rent Scenario
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 bg-muted rounded">
                <p className="text-xs text-muted-foreground">Est. Monthly Rent</p>
                <p className="font-semibold">{formatCurrency(estimatedRent)}</p>
              </div>
              <div className="p-2 bg-muted rounded">
                <p className="text-xs text-muted-foreground">Operating Expenses</p>
                <p className="font-semibold">{formatCurrency(monthlyOperatingExpenses)}</p>
              </div>
              <div className="p-2 bg-blue-100 dark:bg-blue-950 rounded">
                <p className="text-xs text-muted-foreground">Monthly Cash Flow</p>
                <p className="font-semibold text-blue-600">{formatCurrency(monthlyCashFlow)}</p>
              </div>
              <div className="p-2 bg-blue-100 dark:bg-blue-950 rounded">
                <p className="text-xs text-muted-foreground">Annual Cash Flow</p>
                <p className="font-semibold text-blue-600">{formatCurrency(annualCashFlow)}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              1% Rule: {((estimatedRent / propertyData.price) * 100).toFixed(2)}% 
              {(estimatedRent / propertyData.price) >= 0.01 ? " ✅ Meets 1% rule" : " ⚠️ Below 1% rule"}
            </p>
          </div>

          {/* Action Plan */}
          <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
            <Lightbulb className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm">
              <strong>Investment Timeline:</strong><br />
              {recommendedStrategy === "Flip" && "• Months 1-2: Rehab work\n• Month 3: List property\n• Month 4-6: Close sale\n• Expected hold time: 4-6 months"}
              {recommendedStrategy === "Hold & Rent" && "• Month 1: Secure tenant\n• Months 2+: Collect rent, build equity\n• Expected hold time: 3-7+ years"}
              {recommendedStrategy === "BRRRR (Buy, Rehab, Rent, Refinance, Repeat)" && "• Months 1-2: Rehab to ARV\n• Month 3: Rent to qualified tenant\n• Month 6-12: Cash-out refinance at 75% LTV\n• Recycle capital into next deal"}
            </AlertDescription>
          </Alert>

          {/* Risk Factors */}
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4" />
              Key Risk Factors
            </h3>
            <div className="space-y-1 text-xs text-muted-foreground">
              {rehab > propertyData.price * 0.2 && (
                <p>⚠️ High rehab costs ({((rehab / propertyData.price) * 100).toFixed(0)}% of purchase) - risk of overruns</p>
              )}
              {monthlyCashFlow < 100 && (
                <p>⚠️ Thin cash flow margins - limited buffer for vacancies</p>
              )}
              {propertyData.price > 500000 && (
                <p>⚠️ Higher price point may limit buyer/renter pool</p>
              )}
              <p>✓ Always budget 10-15% contingency for unexpected repairs</p>
              <p>✓ Verify rental comps with 3+ recent leases in the area</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Regular Buyer Playbook
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Home className="h-5 w-5" />
          Home Buyer Insights
        </CardTitle>
        <CardDescription>Balanced analysis for your home purchase</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertDescription>
            <strong>Market Position:</strong> This {propertyData.beds}-bedroom home is priced at 
            {formatCurrency(propertyData.price / propertyData.sqft)}/sqft.
            {propertyData.price / propertyData.sqft < 200 && " This is below average and may indicate good value."}
            {propertyData.price / propertyData.sqft >= 200 && propertyData.price / propertyData.sqft < 300 && " This is in the typical market range."}
            {propertyData.price / propertyData.sqft >= 300 && " This is above average - ensure premium finishes justify the price."}
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Key Considerations</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p>Get a professional home inspection before closing ($300-500)</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p>Budget 1-3% of home value annually for maintenance</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p>Consider future resale value and neighborhood trends</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p>Review HOA rules and restrictions if applicable</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
