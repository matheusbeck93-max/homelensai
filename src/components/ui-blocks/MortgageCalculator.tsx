import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { calculateMortgage, formatCurrency, formatPercent } from "@/lib/calculations";
import { Separator } from "@/components/ui/separator";
import { Calculator, Home } from "lucide-react";

interface MortgageCalculatorProps {
  title: string;
  inputs: {
    price: number;
    downPct: number;
    ratePct: number;
    years: number;
    taxPct: number;
    insuranceAnnual: number;
    hoaMonthly: number;
    pmiPct: number;
    pointsPct: number;
    closingCosts: number;
  };
}

export const MortgageCalculator: React.FC<MortgageCalculatorProps> = ({
  title,
  inputs: initialInputs,
}) => {
  const [inputs, setInputs] = useState({
    ...initialInputs,
    // Ensure no negative values
    price: Math.max(0, initialInputs.price),
    downPct: Math.max(0, Math.min(100, initialInputs.downPct)),
    ratePct: Math.max(0, initialInputs.ratePct),
    years: Math.max(1, Math.min(50, initialInputs.years)),
    taxPct: Math.max(0, initialInputs.taxPct),
    insuranceAnnual: Math.max(0, initialInputs.insuranceAnnual),
    hoaMonthly: Math.max(0, initialInputs.hoaMonthly),
    pmiPct: Math.max(0, initialInputs.pmiPct),
    pointsPct: Math.max(0, initialInputs.pointsPct),
    closingCosts: Math.max(0, initialInputs.closingCosts)
  });

  const updateInput = (field: keyof typeof inputs, value: number) => {
    // Basic validation
    let validatedValue = Math.max(0, value);
    
    // Additional constraints for specific fields
    if (field === 'downPct' || field === 'taxPct' || field === 'pmiPct' || field === 'pointsPct') {
      validatedValue = Math.min(100, validatedValue);
    }
    if (field === 'years') {
      validatedValue = Math.max(1, Math.min(50, validatedValue));
    }
    
    setInputs((prev) => ({ ...prev, [field]: validatedValue }));
  };

  const results = calculateMortgage(
    inputs.price,
    inputs.downPct,
    inputs.ratePct,
    inputs.years,
    inputs.taxPct,
    inputs.insuranceAnnual,
    inputs.hoaMonthly,
    inputs.pmiPct,
    inputs.pointsPct,
    inputs.closingCosts
  );

  return (
    <Card className="w-full my-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column: Inputs */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Loan Details
            </h3>

            <div className="space-y-3">
              <div>
                <Label htmlFor="price">Home Price</Label>
                <Input
                  id="price"
                  type="number"
                  value={inputs.price}
                  onChange={(e) => updateInput('price', Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="downPct">Down Payment (%)</Label>
                <Input
                  id="downPct"
                  type="number"
                  step="0.1"
                  value={inputs.downPct}
                  onChange={(e) => updateInput('downPct', Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="ratePct">Interest Rate (APR %)</Label>
                <Input
                  id="ratePct"
                  type="number"
                  step="0.01"
                  value={inputs.ratePct}
                  onChange={(e) => updateInput('ratePct', Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="years">Loan Term (years)</Label>
                <Input
                  id="years"
                  type="number"
                  value={inputs.years}
                  onChange={(e) => updateInput('years', Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <Separator className="my-2" />

              <div>
                <Label htmlFor="taxPct">Property Tax (%/year)</Label>
                <Input
                  id="taxPct"
                  type="number"
                  step="0.01"
                  value={inputs.taxPct}
                  onChange={(e) => updateInput('taxPct', Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="insuranceAnnual">Insurance (annual)</Label>
                <Input
                  id="insuranceAnnual"
                  type="number"
                  value={inputs.insuranceAnnual}
                  onChange={(e) => updateInput('insuranceAnnual', Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="hoaMonthly">HOA (monthly)</Label>
                <Input
                  id="hoaMonthly"
                  type="number"
                  value={inputs.hoaMonthly}
                  onChange={(e) => updateInput('hoaMonthly', Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              {inputs.downPct < 20 && (
                <div>
                  <Label htmlFor="pmiPct">PMI (%/year)</Label>
                  <Input
                    id="pmiPct"
                    type="number"
                    step="0.01"
                    value={inputs.pmiPct}
                    onChange={(e) => updateInput('pmiPct', Number(e.target.value))}
                    className="mt-1"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="pointsPct">Points (%)</Label>
                <Input
                  id="pointsPct"
                  type="number"
                  step="0.01"
                  value={inputs.pointsPct}
                  onChange={(e) => updateInput('pointsPct', Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="closingCosts">Closing Costs</Label>
                <Input
                  id="closingCosts"
                  type="number"
                  value={inputs.closingCosts}
                  onChange={(e) => updateInput('closingCosts', Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Monthly Payment Breakdown
            </h3>

            <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm">Principal & Interest</span>
                <span className="font-semibold">{formatCurrency(results.monthlyPI)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm">Property Tax</span>
                <span className="font-semibold">{formatCurrency(results.monthlyTax)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm">Insurance</span>
                <span className="font-semibold">{formatCurrency(results.monthlyInsurance)}</span>
              </div>

              {results.monthlyHOA > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm">HOA</span>
                  <span className="font-semibold">{formatCurrency(results.monthlyHOA)}</span>
                </div>
              )}

              {results.monthlyPMI > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm">PMI</span>
                  <span className="font-semibold">{formatCurrency(results.monthlyPMI)}</span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between items-center text-lg">
                <span className="font-bold">Total Monthly</span>
                <span className="font-bold text-primary">{formatCurrency(results.totalMonthly)}</span>
              </div>
            </div>

            <Separator className="my-4" />

            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              One-Time Costs
            </h3>

            <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm">Down Payment</span>
                <span className="font-semibold">{formatCurrency(results.downPayment)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm">Loan Amount</span>
                <span className="font-semibold">{formatCurrency(results.loanAmount)}</span>
              </div>

              {results.pointsCost > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm">Points Cost</span>
                  <span className="font-semibold">{formatCurrency(results.pointsCost)}</span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-sm">Closing Costs</span>
                <span className="font-semibold">{formatCurrency(inputs.closingCosts)}</span>
              </div>

              <Separator />

              <div className="flex justify-between items-center text-lg">
                <span className="font-bold">Total Cash Needed</span>
                <span className="font-bold text-primary">{formatCurrency(results.totalCashNeeded)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
