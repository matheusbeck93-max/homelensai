/**
 * Daily FRED prefetch — warms the fred_cache table so user-facing
 * tools never hit FRED cold. Invoked by pg_cron at 6am ET (insert via
 * supabase--insert, not migration, since the SQL embeds project URL).
 *
 * Uses `force: true` to bypass cache and refresh every series listed in
 * PREFETCH_SERIES (mortgage rates + drivers + national + 20 metros).
 * Total: ~27 FRED calls/day, well under the 120/min limit.
 */

import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { getFredSeries } from '../_shared/fred-client.ts';
import { PREFETCH_SERIES } from '../_shared/fred-series.ts';
import { requireCronAuth } from '../_shared/cronAuth.ts';
import { withCronLog } from '../_shared/cron-log.ts';
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

const log = createLogger('fred-prefetch-daily');

Deno.serve((req: Request) => withRequestOrigin(req, () => (withCronLog("fred-prefetch-daily", async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const authFail = requireCronAuth(req);
  if (authFail) return authFail;

  const results: Array<{ series_id: string; ok: boolean; error?: string }> = [];

  // Process in small batches to be polite to FRED (~120/min limit).
  const BATCH = 5;
  for (let i = 0; i < PREFETCH_SERIES.length; i += BATCH) {
    const batch = PREFETCH_SERIES.slice(i, i + BATCH);
    const settled = await Promise.allSettled(
      batch.map((sid) => getFredSeries(sid, { limit: 60, force: true })),
    );
    settled.forEach((s, idx) => {
      const sid = batch[idx];
      if (s.status === 'fulfilled') {
        results.push({ series_id: sid, ok: true });
      } else {
        results.push({ series_id: sid, ok: false, error: getErrorMessage(s.reason) });
      }
    });
    // brief pause between batches
    if (i + BATCH < PREFETCH_SERIES.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  log.info('fred-prefetch-daily complete', {
    total: results.length,
    ok: okCount,
    failed: results.length - okCount,
  });

  return jsonResponse({
    total: results.length,
    ok: okCount,
    failed: results.length - okCount,
    results,
  });
}))(req)));