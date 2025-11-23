import { Card } from "@/components/ui/card";
import { TrendingUp, DollarSign, Home, PiggyBank } from "lucide-react";
import type { PortfolioProperty } from "@/pages/Portfolio";

interface PortfolioOverviewProps {
  portfolio: PortfolioProperty[];
}

export function PortfolioOverview({ portfolio }: PortfolioOverviewProps) {
  const calculateMetrics = () => {
    let totalValue = 0;
    let totalEquity = 0;
    let totalMonthlyRent = 0;
    let totalMonthlyExpenses = 0;
    let totalMortgagePayment = 0;

    portfolio.forEach((item) => {
      const propertyValue = item.property.price || item.purchase_price;
      const loanAmount = item.purchase_price * (1 - item.down_payment_pct / 100);
      const downPayment = item.purchase_price * (item.down_payment_pct / 100);
      
      // Calculate monthly mortgage payment (P&I only)
      const monthlyRate = item.interest_rate_pct / 100 / 12;
      const numPayments = item.loan_term_years * 12;
      const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                             (Math.pow(1 + monthlyRate, numPayments) - 1);

      totalValue += propertyValue;
      totalEquity += downPayment;
      totalMonthlyRent += item.monthly_rent;
      totalMonthlyExpenses += item.monthly_expenses;
      totalMortgagePayment += monthlyPayment;
    });

    const totalMonthlyCashFlow = totalMonthlyRent - totalMonthlyExpenses - totalMortgagePayment;
    const annualCashFlow = totalMonthlyCashFlow * 12;
    const combinedROI = totalEquity > 0 ? (annualCashFlow / totalEquity) * 100 : 0;

    return {
      totalValue,
      totalEquity,
      totalMonthlyCashFlow,
      combinedROI,
      propertyCount: portfolio.length
    };
  };

  const metrics = calculateMetrics();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Home className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Properties</p>
            <h3 className="text-2xl font-bold">{metrics.propertyCount}</h3>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <DollarSign className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Value</p>
            <h3 className="text-2xl font-bold">{formatCurrency(metrics.totalValue)}</h3>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <PiggyBank className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Monthly Cash Flow</p>
            <h3 className={`text-2xl font-bold ${metrics.totalMonthlyCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(metrics.totalMonthlyCashFlow)}
            </h3>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Combined ROI</p>
            <h3 className={`text-2xl font-bold ${metrics.combinedROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercent(metrics.combinedROI)}
            </h3>
          </div>
        </div>
      </Card>
    </div>
  );
}
