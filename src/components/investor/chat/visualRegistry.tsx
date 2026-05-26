import type { ToolEvent } from '@/lib/investorChat/turnTypes';
import { MetricsGrid } from './visuals/MetricsGrid';
import { RoiTimeline } from './visuals/RoiTimeline';
import { BuyingPowerView } from './visuals/BuyingPowerView';
import { AmortizationChart } from './visuals/AmortizationChart';
import { MarketStatsCard } from './visuals/MarketStatsCard';
import { PropertyTable } from './visuals/PropertyTable';
import { ComparisonTable } from './visuals/ComparisonTable';
import { ReductionHeatmap } from './visuals/ReductionHeatmap';
import { ComparableSales } from './visuals/ComparableSales';
import { ToolCardShell } from './visuals/ToolCardShell';

export function renderToolEvent(event: ToolEvent) {
  switch (event.name) {
    case 'compute_metrics': return <MetricsGrid event={event} />;
    case 'compute_roi': return <RoiTimeline event={event} />;
    case 'compute_buying_power': return <BuyingPowerView event={event} />;
    case 'project_amortization': return <AmortizationChart event={event} />;
    case 'get_market_stats': return <MarketStatsCard event={event} />;
    case 'list_listings': return <PropertyTable event={event} />;
    case 'compare_properties': return <ComparisonTable event={event} />;
    case 'show_reduction_heatmap': return <ReductionHeatmap event={event} />;
    case 'find_comparable_sales': return <ComparableSales event={event} />;
    default:
      return (
        <ToolCardShell anchor={event.anchor} status={event.status} error={event.error}>
          <pre className="text-[10px] overflow-x-auto">{JSON.stringify(event.output, null, 2)}</pre>
        </ToolCardShell>
      );
  }
}