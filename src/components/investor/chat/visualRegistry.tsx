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
import { AffordabilityIndex } from './visuals/AffordabilityIndex';
import { ArvEstimate } from './visuals/ArvEstimate';
import { FlipSpread } from './visuals/FlipSpread';
import { NeighborhoodQuality } from './visuals/NeighborhoodQuality';
import { MigrationTrend } from './visuals/MigrationTrend';
import { EmploymentTrend } from './visuals/EmploymentTrend';
import { AbsorptionRate } from './visuals/AbsorptionRate';
import { SupplyPipeline } from './visuals/SupplyPipeline';

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
    case 'compute_affordability_index': return <AffordabilityIndex event={event} />;
    case 'estimate_arv': return <ArvEstimate event={event} />;
    case 'compute_flip_spread': return <FlipSpread event={event} />;
    case 'get_neighborhood_quality': return <NeighborhoodQuality event={event} />;
    case 'get_migration_trends': return <MigrationTrend event={event} />;
    case 'get_employment_trends': return <EmploymentTrend event={event} />;
    case 'get_absorption_rate': return <AbsorptionRate event={event} />;
    case 'get_supply_pipeline': return <SupplyPipeline event={event} />;
    default:
      return (
        <ToolCardShell anchor={event.anchor} status={event.status} error={event.error}>
          <pre className="text-[10px] overflow-x-auto">{JSON.stringify(event.output, null, 2)}</pre>
        </ToolCardShell>
      );
  }
}