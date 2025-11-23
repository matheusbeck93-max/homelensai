import { TrendingDown, TrendingUp, Minus, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getFairnessLabel,
  getFairnessDescription,
  getFairnessColor,
  type PriceFairnessResult
} from "@/lib/pricingUtils";

interface PriceFairnessMeterProps {
  result: PriceFairnessResult;
  isLocked?: boolean;
  onUpgradeClick?: () => void;
  compact?: boolean;
}

export function PriceFairnessMeter({ 
  result, 
  isLocked = false, 
  onUpgradeClick,
  compact = false 
}: PriceFairnessMeterProps) {
  const colors = getFairnessColor(result.level);
  const label = getFairnessLabel(result.level);
  const description = getFairnessDescription(result);

  if (isLocked) {
    return (
      <div 
        onClick={onUpgradeClick}
        className="flex items-center gap-2 px-3 py-2 bg-muted/50 border border-border rounded-lg cursor-pointer hover:bg-muted transition-colors"
      >
        <Lock className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground">Price Fairness</p>
          <p className="text-xs text-muted-foreground">Pro feature</p>
        </div>
        <Badge variant="secondary" className="text-xs">Pro</Badge>
      </div>
    );
  }

  if (compact) {
    return (
      <Badge 
        variant="outline" 
        className={cn("gap-1.5", colors.bg, colors.text, colors.border)}
      >
        {result.percentageDiff < -5 && <TrendingDown className="h-3 w-3" />}
        {result.percentageDiff > 5 && <TrendingUp className="h-3 w-3" />}
        {Math.abs(result.percentageDiff) <= 5 && <Minus className="h-3 w-3" />}
        {label}
      </Badge>
    );
  }

  return (
    <div className={cn("px-3 py-2 border rounded-lg", colors.bg, colors.border)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {result.percentageDiff < -5 && <TrendingDown className={cn("h-4 w-4", colors.text)} />}
          {result.percentageDiff > 5 && <TrendingUp className={cn("h-4 w-4", colors.text)} />}
          {Math.abs(result.percentageDiff) <= 5 && <Minus className={cn("h-4 w-4", colors.text)} />}
          <div>
            <p className={cn("text-sm font-semibold", colors.text)}>{label}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
