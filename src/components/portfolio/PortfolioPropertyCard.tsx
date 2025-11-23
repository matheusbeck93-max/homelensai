import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, ExternalLink, TrendingUp } from "lucide-react";
import { EditPortfolioDialog } from "./EditPortfolioDialog";
import { InvestmentProjections } from "./InvestmentProjections";
import type { PortfolioProperty } from "@/pages/Portfolio";
import { useNavigate } from "react-router-dom";

interface PortfolioPropertyCardProps {
  portfolioProperty: PortfolioProperty;
  onRemove: (id: string) => void;
  onUpdate: () => void;
}

export function PortfolioPropertyCard({ portfolioProperty, onRemove, onUpdate }: PortfolioPropertyCardProps) {
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const [showProjections, setShowProjections] = useState(false);
  const { property } = portfolioProperty;

  const calculateMetrics = () => {
    const loanAmount = portfolioProperty.purchase_price * (1 - portfolioProperty.down_payment_pct / 100);
    const monthlyRate = portfolioProperty.interest_rate_pct / 100 / 12;
    const numPayments = portfolioProperty.loan_term_years * 12;
    
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                           (Math.pow(1 + monthlyRate, numPayments) - 1);
    
    const monthlyCashFlow = portfolioProperty.monthly_rent - portfolioProperty.monthly_expenses - monthlyPayment;
    const downPayment = portfolioProperty.purchase_price * (portfolioProperty.down_payment_pct / 100);
    const annualCashFlow = monthlyCashFlow * 12;
    const cashOnCashReturn = downPayment > 0 ? (annualCashFlow / downPayment) * 100 : 0;

    return {
      monthlyPayment,
      monthlyCashFlow,
      cashOnCashReturn
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

  const imageUrl = property.image_urls?.[0] || '/placeholder.svg';

  return (
    <>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        <div 
          className="relative h-48 bg-muted cursor-pointer"
          onClick={() => navigate(`/property/${property.id}`)}
        >
          <img
            src={imageUrl}
            alt={property.address}
            className="w-full h-full object-cover"
          />
        </div>
        
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div 
              className="flex-1 cursor-pointer"
              onClick={() => navigate(`/property/${property.id}`)}
            >
              <h3 className="font-semibold text-lg line-clamp-1">{property.address}</h3>
              <p className="text-sm text-muted-foreground">
                {property.city}, {property.state} {property.zip}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/property/${property.id}`)}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Purchase Price:</span>
              <span className="font-medium">{formatCurrency(portfolioProperty.purchase_price)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Monthly Rent:</span>
              <span className="font-medium">{formatCurrency(portfolioProperty.monthly_rent)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Monthly Cash Flow:</span>
              <span className={`font-medium ${metrics.monthlyCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(metrics.monthlyCashFlow)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cash-on-Cash ROI:</span>
              <Badge variant={metrics.cashOnCashReturn >= 8 ? "default" : "secondary"}>
                {metrics.cashOnCashReturn.toFixed(2)}%
              </Badge>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowProjections(!showProjections)}
              className="flex-1"
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              {showProjections ? 'Hide' : 'Show'} Projections
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEdit(true)}
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onRemove(portfolioProperty.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </Card>

      {showProjections && (
        <div className="mt-4">
          <InvestmentProjections portfolioProperty={portfolioProperty} />
        </div>
      )}

      <EditPortfolioDialog
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        portfolioProperty={portfolioProperty}
        onUpdate={onUpdate}
      />
    </>
  );
}
