import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateBuyingPower, formatCurrency } from "@/lib/calculations";
import { Separator } from "@/components/ui/separator";
import { DollarSign, TrendingUp, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface IndividualBuyingPowerCalculatorProps {
  title: string;
  inputs: {
    incomeMonthly: number;
    debtsMonthly: number;
    expensesMonthly: number;
    savings: number;
    creditScore: number;
    riskTolerance: string;
    investmentMonthly: number;
  };
  scenarios: {
    id: string;
    label: string;
    spendingMultiplier: number;
  }[];
}

export const IndividualBuyingPowerCalculator: React.FC<IndividualBuyingPowerCalculatorProps> = ({
  title,
  inputs: initialInputs,
  scenarios,
}) => {
  const [inputs, setInputs] = useState({
    ...initialInputs,
    // Ensure no negative values
    incomeMonthly: Math.max(0, initialInputs.incomeMonthly),
    debtsMonthly: Math.max(0, initialInputs.debtsMonthly),
    expensesMonthly: Math.max(0, initialInputs.expensesMonthly),
    savings: Math.max(0, initialInputs.savings),
    creditScore: Math.max(300, Math.min(850, initialInputs.creditScore)),
    investmentMonthly: Math.max(0, initialInputs.investmentMonthly)
  });

  const updateInput = (field: keyof typeof inputs, value: number | string) => {
    if (typeof value === 'number') {
      let validatedValue = Math.max(0, value);
      
      // Credit score should be between 300 and 850
      if (field === 'creditScore') {
        validatedValue = Math.max(300, Math.min(850, validatedValue));
      }
      
      setInputs((prev) => ({ ...prev, [field]: validatedValue }));
    } else {
      setInputs((prev) => ({ ...prev, [field]: value }));
    }
  };

  const results = calculateBuyingPower(
    inputs.incomeMonthly,
    inputs.debtsMonthly,
    inputs.expensesMonthly,
    inputs.savings,
    inputs.creditScore,
    inputs.investmentMonthly
  );

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-600 dark:text-green-400";
    if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return "Excellent";
    if (score >= 40) return "Good";
    return "Needs Improvement";
  };

  return (
    <Card className="w-full my-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Column: Inputs */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Financial Overview
            </h3>

            <div className="space-y-3">
              <div>
                <Label htmlFor="bp-income">Monthly Income</Label>
                <Input
                  id="bp-income"
                  type="number"
                  value={inputs.incomeMonthly}
                  onChange={(e) => updateInput('incomeMonthly', Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="bp-debts">Monthly Debt Payments</Label>
                <Input
                  id="bp-debts"
                  type="number"
                  value={inputs.debtsMonthly}
                  onChange={(e) => updateInput('debtsMonthly', Number(e.target.value))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Credit cards, car loans, student loans, etc.
                </p>
              </div>

              <div>
                <Label htmlFor="bp-expenses">Monthly Living Expenses</Label>
                <Input
                  id="bp-expenses"
                  type="number"
                  value={inputs.expensesMonthly}
                  onChange={(e) => updateInput('expensesMonthly', Number(e.target.value))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Food, utilities, transportation, entertainment, etc.
                </p>
              </div>

              <div>
                <Label htmlFor="bp-investments">Monthly Investments</Label>
                <Input
                  id="bp-investments"
                  type="number"
                  value={inputs.investmentMonthly}
                  onChange={(e) => updateInput('investmentMonthly', Number(e.target.value))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  401k, IRA, stocks, etc.
                </p>
              </div>

              <Separator />

              <div>
                <Label htmlFor="bp-savings">Total Savings</Label>
                <Input
                  id="bp-savings"
                  type="number"
                  value={inputs.savings}
                  onChange={(e) => updateInput('savings', Number(e.target.value))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Available for down payment and closing costs
                </p>
              </div>

              <div>
                <Label htmlFor="bp-credit">Credit Score</Label>
                <Input
                  id="bp-credit"
                  type="number"
                  min="300"
                  max="850"
                  value={inputs.creditScore}
                  onChange={(e) => updateInput('creditScore', Number(e.target.value))}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="bp-risk">Risk Tolerance</Label>
                <Select value={inputs.riskTolerance} onValueChange={(value) => updateInput('riskTolerance', value)}>
                  <SelectTrigger id="bp-risk" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Conservative</SelectItem>
                    <SelectItem value="medium">Moderate</SelectItem>
                    <SelectItem value="high">Aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="space-y-4">
            {/* Buying Power Score */}
            <div className="bg-gradient-to-br from-primary/10 to-accent/10 p-6 rounded-lg">
              <h3 className="font-semibold text-sm uppercase tracking-wide mb-2">
                Buying Power Score
              </h3>
              <div className={`text-5xl font-bold mb-2 ${getScoreColor(results.buyingPowerScore)}`}>
                {Math.round(results.buyingPowerScore)}
              </div>
              <div className="text-sm text-muted-foreground mb-3">
                {getScoreLabel(results.buyingPowerScore)}
              </div>
              <Progress value={results.buyingPowerScore} className="h-2" />
            </div>

            {/* Disposable Income */}
            <div className="bg-muted/30 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Monthly Disposable Income</div>
                  <div className="text-2xl font-bold text-primary mt-1">
                    {formatCurrency(results.disposableIncome)}
                  </div>
                </div>
                <TrendingUp className="h-8 w-8 text-primary opacity-50" />
              </div>
            </div>

            <Separator />

            {/* Spending Scenarios */}
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Monthly Housing Budget Scenarios
            </h3>

            <div className="space-y-3">
              {/* Conservative */}
              <div className="border rounded-lg p-4 bg-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">Conservative (10%)</span>
                  <span className="text-xs text-muted-foreground">Lower Risk</span>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency(results.conservativeSpending)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Recommended for financial stability and emergency funds
                </p>
              </div>

              {/* Standard */}
              <div className="border-2 border-primary rounded-lg p-4 bg-primary/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">Standard (20%)</span>
                  <span className="text-xs text-primary font-medium">Recommended</span>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(results.standardSpending)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Balanced approach with room for savings and lifestyle
                </p>
              </div>

              {/* Aggressive */}
              <div className="border rounded-lg p-4 bg-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">Aggressive (30%)</span>
                  <span className="text-xs text-muted-foreground">Higher Risk</span>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency(results.aggressiveSpending)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum budget - requires tight financial discipline
                </p>
              </div>
            </div>

            {results.disposableIncome < 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-red-600 dark:text-red-400">Negative Cash Flow</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your expenses exceed your income. Consider reducing expenses or increasing income before buying.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
