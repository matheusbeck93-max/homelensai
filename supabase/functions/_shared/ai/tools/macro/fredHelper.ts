/**
 * Internal helper: calls the deployed FRED edge functions from inside
 * another edge function. Keeps the macro tools thin and reuses the
 * fred_cache layer instead of re-implementing caching per tool.
 */

import { getFredSeries, type FredSeriesPayload } from '../../../_shared/fred-client.ts';

export async function getSeriesSafe(
  seriesId: string,
  limit = 60,
): Promise<{ ok: true; payload: FredSeriesPayload } | { ok: false; error: string }> {
  try {
    const { payload } = await getFredSeries(seriesId, { limit });
    return { ok: true, payload };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** YoY percent change derived from a FRED payload. */
export function yoyPct(p: FredSeriesPayload): number | null {
  if (!p.latest?.value || !p.change_yoy) return null;
  const prior = p.latest.value - p.change_yoy.absolute;
  if (!prior) return null;
  return +(((p.latest.value - prior) / prior) * 100).toFixed(2);
}