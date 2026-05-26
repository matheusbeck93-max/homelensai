export interface ToolEvent {
  id: string;
  name: string;
  input?: any;
  output?: any;
  error?: string;
  status: 'running' | 'done' | 'error';
  anchor: string; // e.g. "Metrics Grid"
}

export interface CurrentTurn {
  status: 'idle' | 'streaming' | 'done' | 'error';
  text: string;
  toolEvents: ToolEvent[];
  threadId?: string;
  error?: string;
}

export const TOOL_LABEL: Record<string, string> = {
  compute_metrics: 'Metrics Grid',
  compute_roi: 'ROI Timeline',
  compute_buying_power: 'Buying Power',
  project_amortization: 'Amortization',
  get_market_stats: 'Market Stats',
  list_listings: 'Property Table',
  compare_properties: 'Comparison Table',
  show_reduction_heatmap: 'Reduction Heatmap',
  find_comparable_sales: 'Comparable Sales',
  compute_affordability_index: 'Affordability Index',
  estimate_arv: 'ARV Estimate',
  compute_flip_spread: 'Flip Spread',
  get_neighborhood_quality: 'Neighborhood Quality',
  get_migration_trends: 'Migration Trend',
  get_employment_trends: 'Employment Trend',
  get_absorption_rate: 'Absorption Rate',
  get_supply_pipeline: 'Supply Pipeline',
};

export function anchorFor(name: string): string {
  return TOOL_LABEL[name] ?? name;
}