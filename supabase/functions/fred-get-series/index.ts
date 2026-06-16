/**
 * GET /functions/v1/fred-get-series
 *   ?series_id=MORTGAGE30US
 *   &limit=12
 *   &observation_start=2024-01-01
 *
 * Cache-first FRED observations endpoint. Returns metadata + recent
 * observations + computed 30d/90d/yoy changes. See _shared/fred-client.ts.
 */

import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, validationError } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { getFredSeries } from '../_shared/fred-client.ts';

const log = createLogger('fred-get-series');

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const url = new URL(req.url);
    const seriesId = url.searchParams.get('series_id');
    if (!seriesId) return validationError('series_id is required');

    const limit = Number(url.searchParams.get('limit') ?? 60);
    const observationStart = url.searchParams.get('observation_start') ?? undefined;

    const { payload, cacheHit } = await getFredSeries(seriesId, {
      limit,
      observationStart,
    });

    return jsonResponse({ ...payload, cache_hit: cacheHit });
  } catch (err) {
    log.error('fred-get-series failed', { error: getErrorMessage(err) });
    return errorResponse(getErrorMessage(err), 500);
  }
});