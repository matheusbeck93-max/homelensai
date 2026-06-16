/**
 * Shared utilities for detecting "material" macro shifts. Consumed by
 * downstream alert pipelines (rate-move emails, brief warnings).
 *
 * Thresholds are deliberately conservative — these are user-facing
 * "you should know" events, not analyst-grade noise.
 */

export interface RateMoveSignal {
  triggered: boolean;
  direction: 'up' | 'down' | 'flat';
  bps: number;
  window: '30d' | '90d';
  headline: string;
}

/** Material rate move = ±25 bps over 30 days. */
export function detectRateMove(input: {
  change_30d_bps: number | null;
  change_90d_bps?: number | null;
}): RateMoveSignal {
  const bps30 = input.change_30d_bps ?? 0;
  const bps90 = input.change_90d_bps ?? 0;
  const triggered30 = Math.abs(bps30) >= 25;
  const triggered90 = Math.abs(bps90) >= 50;
  if (!triggered30 && !triggered90) {
    return { triggered: false, direction: 'flat', bps: bps30, window: '30d', headline: '' };
  }
  const useThirty = triggered30 || !triggered90;
  const bps = useThirty ? bps30 : bps90;
  const window = useThirty ? '30d' : '90d';
  const direction = bps > 0 ? 'up' : 'down';
  const headline =
    direction === 'down'
      ? `Mortgage rates eased ${Math.abs(bps)} bps over the past ${window}.`
      : `Mortgage rates climbed ${Math.abs(bps)} bps over the past ${window}.`;
  return { triggered: true, direction, bps, window, headline };
}