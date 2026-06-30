/**
 * Weekly BLS prefetch — warms `bls_cache` for the top-15 metros so the
 * labor-market and wage tools never hit BLS cold. Invoked by pg_cron
 * Sundays 03:00 UTC.
 *
 * Series prefetched per metro:
 *   - LAUS unemployment rate (monthly)
 *   - LAUS labor force (monthly)
 *   - OEWS median annual wage (annual)
 * Total: ~45 BLS calls / week — well inside the 500/day key cap.
 */

import { handleCors } from '../_shared/cors.ts';
import { jsonResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { requireCronAuth } from '../_shared/cronAuth.ts';
import { getBlsSeries, blsLaus, blsOews, TOP_MSA_CODES } from '../_shared/bls-client.ts';
import { withCronLog } from '../_shared/cron-log.ts';

const log = createLogger('bls-prefetch-weekly');

// Top-15 by population — subset of TOP_MSA_CODES.
const PREFETCH_METROS: string[] = [
  'new york',
  'los angeles',
  'chicago',
  'dallas',
  'houston',
  'washington',
  'miami',
  'philadelphia',
  'atlanta',
  'phoenix',
  'boston',
  'san francisco',
  'seattle',
  'denver',
  'austin',
];

Deno.serve(withCronLog("bls-prefetch-weekly", async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const authFail = requireCronAuth(req);
  if (authFail) return authFail;

  const results: Array<{ metro: string; ok: boolean; error?: string }> = [];

  for (const key of PREFETCH_METROS) {
    const msa = TOP_MSA_CODES[key];
    if (!msa) {
      results.push({ metro: key, ok: false, error: 'unknown metro' });
      continue;
    }
    try {
      await Promise.all([
        getBlsSeries({
          cacheKey: `bls_laus_${msa.code}`,
          seriesIds: [blsLaus.unemploymentRate(msa.code), blsLaus.laborForce(msa.code)],
          force: true,
        }),
        getBlsSeries({
          cacheKey: `bls_oews_wage_${msa.code}`,
          seriesIds: [blsOews.medianAnnualWageAllOcc(msa.code)],
          ttlMinutes: 60 * 24 * 30,
          force: true,
        }),
        getBlsSeries({
          cacheKey: `bls_oews_wage_yoy_${msa.code}`,
          seriesIds: [blsOews.medianAnnualWageAllOcc(msa.code)],
          startYear: new Date().getFullYear() - 3,
          ttlMinutes: 60 * 24 * 30,
          force: true,
        }),
      ]);
      results.push({ metro: msa.name, ok: true });
    } catch (e) {
      results.push({ metro: msa.name, ok: false, error: getErrorMessage(e) });
    }
    // brief pause to be polite to BLS API
    await new Promise((r) => setTimeout(r, 750));
  }

  const okCount = results.filter((r) => r.ok).length;
  log.info('bls-prefetch-weekly complete', {
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
}));