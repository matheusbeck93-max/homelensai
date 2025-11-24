import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { calculateInvestorMetrics, formatCurrency, formatPercent } from "@/lib/calculations";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, DollarSign, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface HomeLensInvestorCalculatorProps {
  title: string;
  inputs: {
    price: number;
    downPct: number;
    ratePct: number;
    years: number;
    rentMonthly: number;
    vacancyPct: number;
    taxPct: number;
    insuranceAnnual: number;
    repairsPct: number;
    capexPct: number;
    managementPct: number;
    hoaMonthly: number;
    closingCosts: number;
  };
  rentEstimate?: {
    amount: number;
    source: 'rentcast' | 'user';
  };
}

export const HomeLensInvestorCalculator: React.FC<HomeLensInvestorCalculatorProps> = ({
  title,
  inputs: initialInputs,
  rentEstimate,
}) => {
  const [inputs, setInputs] = useState({
    ...initialInputs,
    // Ensure no negative values with validation
    price: Math.max(0, initialInputs.price),
    downPct: Math.max(0, Math.min(100, initialInputs.downPct)),
    ratePct: Math.max(0, initialInputs.ratePct),
    years: Math.max(1, Math.min(50, initialInputs.years)),
    rentMonthly: Math.max(0, initialInputs.rentMonthly),
    vacancyPct: Math.max(0, Math.min(100, initialInputs.vacancyPct)),
    taxPct: Math.max(0, initialInputs.taxPct),
    insuranceAnnual: Math.max(0, initialInputs.insuranceAnnual),
    repairsPct: Math.max(0, Math.min(100, initialInputs.repairsPct)),
    capexPct: Math.max(0, Math.min(100, initialInputs.capexPct)),
    managementPct: Math.max(0, Math.min(100, initialInputs.managementPct)),
    hoaMonthly: Math.max(0, initialInputs.hoaMonthly),
    closingCosts: Math.max(0, initialInputs.closingCosts)
  });

  const updateInput = (field: keyof typeof inputs, value: number) => {
    // Basic validation
    let validatedValue = Math.max(0, value);
    
    // Percentage fields should be capped at 100
    if (['downPct', 'vacancyPct', 'taxPct', 'repairsPct', 'capexPct', 'managementPct'].includes(field)) {
      validatedValue = Math.min(100, validatedValue);
    }
    if (field === 'years') {
      validatedValue = Math.max(1, Math.min(50, validatedValue));
    }
    
    setInputs((prev) => ({ ...prev, [field]: validatedValue }));
  };

  const results = calculateInvestorMetrics(
    inputs.price,
    inputs.downPct,
    inputs.ratePct,
    inputs.years,
    inputs.rentMonthly,
    inputs.vacancyPct,
    inputs.taxPct,
    inputs.insuranceAnnual,
    inputs.repairsPct,
    inputs.capexPct,
    inputs.managementPct,
    inputs.hoaMonthly,
    inputs.closingCosts
  );

  const isPositiveCashFlow = results.monthlyCashFlow > 0;
  const isGoodDSCR = results.dscr >= 1.25;

  return (
    <Card className="w-full my-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column: Inputs */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Property & Financing
            </h3>

            <div className="space-y-3">
              <div>
                <Label htmlFor="inv-price">Purchase Price</Label>
                <Input
                  id="inv-price"
                  type="number"
                  value={inputs.price}
                  onChange={(e) => updateInput('price', Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="inv-downPct">Down Payment (%)</Label>
                <Input
                  id="inv-downPct"
                  type="number"
                  step="0.1"
                  value={inputs.downPct}
                  onChange={(e) => updateInput('downPct', Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="inv-ratePct">Interest Rate (APR %)</Label>
                <Input
                  id="inv-ratePct"
                  type="number"
                  step="0.01"
                  value={inputs.ratePct}
                  onChange={(e) => updateInput('ratePct', Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="inv-years">Loan Term (years)</Label>
                <Input
                  id="inv-years"
                  type="number"
                  value={inputs.years}
                  onChange={(e) => updateInput('years', Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="inv-closingCosts">Closing Costs</Label>
                <Input
                  id="inv-closingCosts"
                  type="number"
                  value={inputs.closingCosts}
                  onChange={(e) => updateInput('closingCosts', Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <Separator className="my-2" />

              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Income & Expenses
              </h3>

              <div>
                <Label htmlFor="inv-rentMonthly">Monthly Rent</Label>
                <div className="relative">
                  <Input
                    id="inv-rentMonthly"
                    type="number"
                    value={inputs.rentMonthly}
                    onChange={(e) => updateInput('rentMonthly', Number(e.target.value))}
                    className="mt-1"
                  />
                  {rentEstimate && rentEstimate.source === 'rentcast' && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3" />
                      <span>Pre-filled from RentCast (editable)</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="inv-vacancyPct">Vacancy Rate (%)</Label>
                <Input
                  id="inv-vacancyPct"
                  type="number"
                  step="0.1"
                  value={inputs.vacancyPct}
                  onChange={(e) => updateInput('vacancyPct', Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="inv-taxPct">Property Tax (%/year)</Label>
                <Input
                  id="inv-taxPct"
                  type="number"
                  step="0.01"
                  value={inputs.taxPct}
                  onChange={(e) => updateInput('taxPct', Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="inv-insuranceAnnual">Insurance (annual)</Label>
                <Input
                  id="inv-insuranceAnnual"
                  type="number"
                  value={inputs.insuranceAnnual}
                  onChange={(e) => updateInput('insuranceAnnual', Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="inv-repairsPct">Repairs (% of rent)</Label>
                <Input
                  id="inv-repairsPct"
                  type="number"
                  step="0.1"
                  value={inputs.repairsPct}
                  onChange={(e) => updateInput('repairsPct', Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="inv-capexPct">CapEx (% of rent)</Label>
                <Input
                  id="inv-capexPct"
                  type="number"
                  step="0.1"
                  value={inputs.capexPct}
                  onChange={(e) => updateInput('capexPct', Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="inv-managementPct">Management (% of rent)</Label>
                <Input
                  id="inv-managementPct"
                  type="number"
                  step="0.1"
                  value={inputs.managementPct}
                  onChange={(e) => updateInput('managementPct', Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="inv-hoaMonthly">HOA (monthly)</Label>
                <Input
                  id="inv-hoaMonthly"
                  type="number"
                  value={inputs.hoaMonthly}
                  onChange={(e) => updateInput('hoaMonthly', Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="space-y-4">
            {/* Cash Flow Analysis */}
            <div className={`p-4 rounded-lg ${isPositiveCashFlow ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              <h3 className="font-semibold text-sm uppercase tracking-wide mb-3">
                Monthly Cash Flow
              </h3>
              <div className="text-3xl font-bold">
                <span className={isPositiveCashFlow ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  {formatCurrency(results.monthlyCashFlow)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {formatCurrency(results.monthlyCashFlow * 12)}/year
              </div>
            </div>

            {/* Key Metrics */}
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Investment Metrics
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 p-3 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Cap Rate</div>
                <div className="text-xl font-bold">{formatPercent(results.capRate)}</div>
              </div>

              <div className="bg-muted/30 p-3 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Cash-on-Cash</div>
                <div className="text-xl font-bold">{formatPercent(results.cashOnCash)}</div>
              </div>

              <div className={`p-3 rounded-lg ${isGoodDSCR ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
                <div className="text-xs text-muted-foreground mb-1">DSCR</div>
                <div className="text-xl font-bold">{results.dscr.toFixed(2)}x</div>
              </div>

              <div className="bg-muted/30 p-3 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Annual NOI</div>
                <div className="text-lg font-bold">{formatCurrency(results.annualNOI)}</div>
              </div>
            </div>

            {!isGoodDSCR && (
              <Alert variant="default">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  DSCR below 1.25 may make it harder to qualify for financing
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            {/* Expense Breakdown */}
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Monthly Breakdown
            </h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Gross Rent</span>
                <span className="font-semibold">{formatCurrency(inputs.rentMonthly)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Vacancy ({inputs.vacancyPct}%)</span>
                <span>-{formatCurrency(inputs.rentMonthly - results.effectiveRent)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Effective Rent</span>
                <span>{formatCurrency(results.effectiveRent)}</span>
              </div>
              
              <Separator className="my-2" />
              
              <div className="flex justify-between text-muted-foreground">
                <span>Mortgage (P&I)</span>
                <span>-{formatCurrency(results.monthlyMortgage)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Property Tax</span>
                <span>-{formatCurrency(results.monthlyTax)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Insurance</span>
                <span>-{formatCurrency(results.monthlyInsurance)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Repairs</span>
                <span>-{formatCurrency(results.monthlyRepairs)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>CapEx</span>
                <span>-{formatCurrency(results.monthlyCapex)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Management</span>
                <span>-{formatCurrency(results.monthlyManagement)}</span>
              </div>
              {results.monthlyHOA > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>HOA</span>
                  <span>-{formatCurrency(results.monthlyHOA)}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Market Data from RentCast */}
            {rentEstimate && rentEstimate.source === 'rentcast' && (
              <div className="bg-muted/30 p-3 rounded-lg">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Market Data
                </h3>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Estimated Rent (RentCast)</span>
                    <span className="font-medium text-foreground">{formatCurrency(rentEstimate.amount)}/mo</span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Break-Even Rent</div>
              <div className="text-lg font-semibold">{formatCurrency(results.breakEvenRent)}/mo</div>
              <div className="text-xs text-muted-foreground mt-1">
                Minimum rent needed for $0 cash flow
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
