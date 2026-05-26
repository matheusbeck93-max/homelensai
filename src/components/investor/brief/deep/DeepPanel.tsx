import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ActiveCardContext } from '@/contexts/InvestorBriefContext';
import { AffordableListingsView } from './AffordableListingsView';
import { MarketBreakdownView } from './MarketBreakdownView';
import { PropertyReductionDetailsView } from './PropertyReductionDetailsView';

interface Props {
  context: ActiveCardContext | null;
  onBack: () => void;
}

export function DeepPanel({ context, onBack }: Props) {
  if (!context) {
    return (
      <div className="border border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground">
        Ask a question on the left — supporting data and visuals will appear here.
      </div>
    );
  }

  const body = (() => {
    switch (context.card.cardType) {
      case 'buying_power':
        return <AffordableListingsView data={context.card.data as any} />;
      case 'heatmap':
        return <PropertyReductionDetailsView data={context.card.data as any} />;
      case 'trend_chart':
      case 'ranked_list':
        return <MarketBreakdownView card={context.card} />;
      default:
        return <MarketBreakdownView card={context.card} />;
    }
  })();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to brief
        </Button>
        <div className="text-xs text-muted-foreground">{context.card.title}</div>
      </div>
      {body}
    </div>
  );
}