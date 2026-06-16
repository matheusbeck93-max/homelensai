/**
 * GET /functions/v1/fred-mortgage-snapshot
 *
 * Bundled "everything the AI needs about rates + macro" endpoint.
 * Pulls 30y/15y mortgage rates, Fed funds, 10y Treasury, Case-Shiller
 * national index, unemployment and CPI in a single call. Returns a
 * compact JSON snapshot plus a narrative_hint the LLM can paraphrase.
 *
 * All sub-calls go through getFredSeries -> fred_cache so the snapshot
 * is effectively cache-only after the daily prefetch warms the table.
 */

import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { getFredSeries, type FredSeriesPayload } from '../_shared/fred-client.ts';
import { FRED_SERIES } from '../_shared/fred-series.ts';

const log = createLogger('fred-mortgage-snapshot');

function latestValue(p: FredSeriesPayload | null): number | null {
  return p?.latest?.value ?? null;
}
function latestDate(p: FredSeriesPayload | null): string | null {
  return p?.latest?.date ?? null;
}

function yoyPct(p: FredSeriesPayload | null): number | null {
  if (!p?.latest?.value) return null;
  const yoy = p.change_yoy;
  if (!yoy) return null;
  const prior = p.latest.value - yoy.absolute;
  if (!prior) return null;
  return +(((p.latest.value - prior) / prior) * 100).toFixed(2);
}

function buildNarrative(rates30: FredSeriesPayload | null, t10: FredSeriesPayload | null): string {
  const bits: string[] = [];
  if (rates30?.change_30d) {
    const dir = rates30.change_30d.percent_pts >= 0 ? 'risen' : 'eased';
    bits.push(
      `30-yr fixed has ${dir} ${Math.abs(rates30.change_30d.percent_pts)} bps over the past month`,
    );
  }
  if (t10?.change_90d) {
    const dir = t10.change_90d.percent_pts >= 0 ? 'higher' : 'lower';
    bits.push(`the 10-yr Treasury is ${Math.abs(t10.change_90d.percent_pts)} bps ${dir} over 90 days`);
  }
  return bits.length ? bits.join('; ') + '.' : 'Rate environment stable over recent weeks.';
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const [m30, m15, ff, t10, cs, ur, cpi] = await Promise.all([
      getFredSeries(FRED_SERIES.MORTGAGE_30Y, { limit: 60 }),
      getFredSeries(FRED_SERIES.MORTGAGE_15Y, { limit: 60 }),
      getFredSeries(FRED_SERIES.FED_FUNDS_DAILY, { limit: 120 }),
      getFredSeries(FRED_SERIES.TREASURY_10Y, { limit: 120 }),
      getFredSeries(FRED_SERIES.CASE_SHILLER_NATL, { limit: 24 }),
      getFredSeries(FRED_SERIES.UNEMPLOYMENT, { limit: 24 }),
      getFredSeries(FRED_SERIES.CPI, { limit: 24 }),
    ]);

    const rates30 = m30.payload;
    const rates15 = m15.payload;
    const fedFunds = ff.payload;
    const treasury10 = t10.payload;
    const caseShiller = cs.payload;
    const unemployment = ur.payload;
    const cpiPayload = cpi.payload;

    const m30Val = latestValue(rates30);
    const t10Val = latestValue(treasury10);
    const spreadBps =
      m30Val != null && t10Val != null ? Math.round((m30Val - t10Val) * 100) : null;

    const snapshot = {
      rates: {
        '30y_fixed': {
          current: m30Val,
          change_30d_bps: rates30.change_30d?.percent_pts ?? null,
          change_90d_bps: rates30.change_90d?.percent_pts ?? null,
          as_of: latestDate(rates30),
        },
        '15y_fixed': {
          current: latestValue(rates15),
          change_30d_bps: rates15.change_30d?.percent_pts ?? null,
          as_of: latestDate(rates15),
        },
      },
      drivers: {
        fed_funds: {
          current: latestValue(fedFunds),
          change_90d_bps: fedFunds.change_90d?.percent_pts ?? null,
          as_of: latestDate(fedFunds),
        },
        treasury_10y: {
          current: t10Val,
          change_90d_bps: treasury10.change_90d?.percent_pts ?? null,
          as_of: latestDate(treasury10),
        },
        mortgage_spread_bps: spreadBps,
      },
      housing_index: {
        case_shiller_national: {
          current: latestValue(caseShiller),
          yoy_pct: yoyPct(caseShiller),
          as_of: latestDate(caseShiller),
        },
      },
      macro: {
        unemployment_pct: latestValue(unemployment),
        cpi_yoy_pct: yoyPct(cpiPayload),
      },
      narrative_hint: buildNarrative(rates30, treasury10),
      source: 'FRED',
      cache_hits: {
        m30: m30.cacheHit,
        m15: m15.cacheHit,
        ff: ff.cacheHit,
        t10: t10.cacheHit,
        cs: cs.cacheHit,
        ur: ur.cacheHit,
        cpi: cpi.cacheHit,
      },
    };

    return jsonResponse(snapshot);
  } catch (err) {
    log.error('fred-mortgage-snapshot failed', { error: getErrorMessage(err) });
    return errorResponse(getErrorMessage(err), 500);
  }
});