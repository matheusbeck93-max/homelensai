import type { ComposedCard } from '@/lib/investorBrief/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  card: ComposedCard;
}

export function MarketBreakdownView({ card }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{card.title}</CardTitle>
        {card.subtitle && (
          <p className="text-xs text-muted-foreground">{card.subtitle}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-relaxed">{card.summary}</p>
      </CardContent>
    </Card>
  );
}