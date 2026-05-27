import { formatDistanceToNow } from 'date-fns';

export type SourceKind =
  | 'user_input'
  | 'derived'
  | 'rentcast'
  | 'zillow'
  | 'market_stats'
  | 'market_snapshots'
  | 'saved_properties'
  | 'saved_analyses'
  | 'owned_properties'
  | 'owned_alerts'
  | 'ai_research'
  | 'heuristic_estimate';

export interface MetricSource {
  /** Short, human-readable label, e.g. "RentCast AVM". */
  label: string;
  kind: SourceKind;
  /** ISO timestamp of when the underlying datum was last refreshed. */
  asOf?: string | null;
  /** Optional caveat — shown verbatim in the tooltip. */
  note?: string;
}

export type CardSources = Record<string, MetricSource>;

/** "2 days ago" — falls back to a static label if no timestamp. */
export function relativeAsOf(asOf?: string | null): string {
  if (!asOf) return 'No timestamp';
  try {
    return `${formatDistanceToNow(new Date(asOf))} ago`;
  } catch {
    return 'Unknown';
  }
}

/** Common preset sources to keep registry entries terse. */
export const KNOWN_SOURCES = {
  userInput: (note?: string): MetricSource => ({
    label: 'Your inputs',
    kind: 'user_input',
    note,
  }),
  amortizedLoan: (asOf?: string | null): MetricSource => ({
    label: 'Amortization schedule (derived from your loan inputs)',
    kind: 'derived',
    asOf: asOf ?? null,
  }),
  rentcastAvm: (asOf?: string | null): MetricSource => ({
    label: 'RentCast AVM',
    kind: 'rentcast',
    asOf: asOf ?? null,
  }),
  manualValuation: (asOf?: string | null): MetricSource => ({
    label: 'Manual override',
    kind: 'user_input',
    asOf: asOf ?? null,
  }),
  savedProperties: (asOf?: string | null): MetricSource => ({
    label: 'Your saved properties',
    kind: 'saved_properties',
    asOf: asOf ?? null,
  }),
  savedAnalyses: (asOf?: string | null): MetricSource => ({
    label: 'Your saved analyses',
    kind: 'saved_analyses',
    asOf: asOf ?? null,
  }),
  ownedAlerts: (asOf?: string | null): MetricSource => ({
    label: 'Portfolio alerts engine',
    kind: 'owned_alerts',
    asOf: asOf ?? null,
    note: 'Generated from your owned-property data and price/rate watchers.',
  }),
  heuristic: (note: string): MetricSource => ({
    label: 'Internal estimate',
    kind: 'heuristic_estimate',
    note,
  }),
} as const;