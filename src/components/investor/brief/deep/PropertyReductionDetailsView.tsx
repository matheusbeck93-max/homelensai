import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HeatmapCard } from '../cards/HeatmapCard';

interface Props {
  data: { market: string; rows: string[]; cols: string[]; values: number[][] };
}

export function PropertyReductionDetailsView({ data }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Price-reduction detail — {data.market}</CardTitle>
        <p className="text-xs text-muted-foreground">
          Reduction intensity per ZIP × week. Darker = more reductions.
        </p>
      </CardHeader>
      <CardContent>
        <HeatmapCard data={data} />
      </CardContent>
    </Card>
  );
}