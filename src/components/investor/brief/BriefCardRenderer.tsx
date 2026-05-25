import type { ComposedCard } from '@/lib/investorBrief/types';
import { InsightCard } from './InsightCard';
import { TrendChartCard } from './cards/TrendChartCard';
import { HeatmapCard } from './cards/HeatmapCard';
import { RankedListCard } from './cards/RankedListCard';
import { MissingDataCard } from './cards/MissingDataCard';
import { SetupCard } from './cards/SetupCard';
import { SampleCard } from './cards/SampleCard';

interface Props {
  card: ComposedCard;
  userId: string | null;
  onPinTalkingPoint?: (text: string) => void;
  onDismiss?: (briefCardId: string) => void;
}

export function BriefCardRenderer({ card, userId, onPinTalkingPoint, onDismiss }: Props) {
  const body = (() => {
    switch (card.cardType) {
      case 'trend_chart':
        return <TrendChartCard data={card.data as any} />;
      case 'heatmap':
        return <HeatmapCard data={card.data as any} />;
      case 'ranked_list':
        return <RankedListCard data={card.data as any} />;
      case 'missing_data':
        return <MissingDataCard data={card.data as any} />;
      case 'setup':
        return <SetupCard data={card.data as any} />;
      case 'sample':
        return <SampleCard data={card.data as any} />;
      default:
        return (
          <p className="text-xs text-muted-foreground">{card.summary || 'No preview available.'}</p>
        );
    }
  })();

  return (
    <InsightCard
      briefCardId={card.id}
      cardType={card.cardType}
      userId={userId}
      title={card.title}
      subtitle={card.subtitle}
      investigatePrompt={card.investigatePrompt}
      summary={card.summary}
      onPinTalkingPoint={onPinTalkingPoint}
      onDismiss={onDismiss}
    >
      {body}
    </InsightCard>
  );
}
