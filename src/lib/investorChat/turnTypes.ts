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
};

export function anchorFor(name: string): string {
  return TOOL_LABEL[name] ?? name;
}