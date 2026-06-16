/**
 * get_wage_affordability — combines BLS OEWS median annual wage for a
 * metro with the current FRED 30-yr mortgage rate to estimate what a
 * local median earner can afford at 28% DTI (single-earner) and a
 * 1.6x dual-earner scenario.
 *
 * Output is intentionally direct: "Median Austin worker can afford a
 * ~$310K home at today's rates." This is the differentiating answer no
 * other consumer real estate AI ships.
 */

import { getBlsSeries, blsOews, resolveMsa } from '../../../bls-client.ts';
import { getFredSeries } from '../../../fred-client.ts';
import { FRED_SERIES } from '../../../fred-series.ts';

export const GET_WAGE_AFFORDABILITY_TOOL = {
  type: 'function' as const,
  function: {
    name: 'get_wage_affordability',
    description:
      'Computes how much home a typical local earner can afford in a US metro at today\'s 30-yr mortgage rate, using BLS OEWS median annual wage and a 28% DTI assumption. Returns both single-earner and dual-earner (1.6x) scenarios. Covered metros: top 20 by population. Prefer this over web search for "who can afford to buy here?" or "is this market affordable to locals?" questions.',
    parameters: {
      type: 'object',
      properties: {
        metro_name: { type: 'string', description: 'Metro name, e.g. "Tampa" or "Tampa, FL". REQUIRED.' },
        down_payment_pct: {
          type: 'number',
          description: 'Down payment as a percent (0-100). Default 20.',
        },
      },
      required: ['metro_name'],
    },
  },
};

/**
 * Solve for max home price given monthly P&I budget and rate.
 *
 *   Pmt = P * r / (1 - (1 + r)^-n)
 *   =>  P = Pmt * (1 - (1+r)^-n) / r
 *   then HomePrice = P / (1 - downPct)
 */
function maxHomePrice(monthlyPI: number, ratePct: number, downPct: number): number {
  const r = ratePct / 100 / 12;
  const n = 360; // 30y
  if (r <= 0) return 0;
  const principal = (monthlyPI * (1 - Math.pow(1 + r, -n))) / r;
  return principal / (1 - downPct / 100);
}

export async function runGetWageAffordability(input: {
  metro_name?: unknown;
  down_payment_pct?: unknown;
}) {
  const name = typeof input.metro_name === 'string' ? input.metro_name.trim() : '';
  if (!name) return { ok: false, error: 'metro_name required' };
  const msa = resolveMsa(name);
  if (!msa) {
    return { ok: false, error: `BLS OEWS coverage limited to top 20 US metros — "${name}" not in map.` };
  }
  const downPct =
    typeof input.down_payment_pct === 'number' &&
    input.down_payment_pct >= 0 &&
    input.down_payment_pct < 80
      ? input.down_payment_pct
      : 20;

  try {
    const [wageSeries, rateSeries] = await Promise.all([
      getBlsSeries({
        cacheKey: `bls_oews_wage_${msa.code}`,
        seriesIds: [blsOews.medianAnnualWageAllOcc(msa.code)],
        ttlMinutes: 60 * 24 * 30, // OEWS is annual; 30d cache
      }),
      getFredSeries(FRED_SERIES.MORTGAGE_30Y, { limit: 4 }),
    ]);

    const wage = wageSeries[blsOews.medianAnnualWageAllOcc(msa.code)]?.latest?.value ?? null;
    const ratePct = rateSeries.payload.latest?.value ?? null;
    if (wage == null || ratePct == null) {
      return { ok: false, error: 'Wage or rate data unavailable.' };
    }

    // 28% DTI budget for housing P&I (simplification — taxes/insurance excluded).
    const monthlySingle = (wage * 0.28) / 12;
    const monthlyDual = ((wage * 1.6) * 0.28) / 12;
    const homeSingle = Math.round(maxHomePrice(monthlySingle, ratePct, downPct) / 1000) * 1000;
    const homeDual = Math.round(maxHomePrice(monthlyDual, ratePct, downPct) / 1000) * 1000;

    return {
      ok: true,
      metro: msa.name,
      median_annual_wage_usd: wage,
      rate_30y_pct: ratePct,
      down_payment_pct: downPct,
      dti_pct: 28,
      single_earner: {
        max_monthly_pi_usd: Math.round(monthlySingle),
        max_home_price_usd: homeSingle,
      },
      dual_earner_1_6x: {
        max_monthly_pi_usd: Math.round(monthlyDual),
        max_home_price_usd: homeDual,
      },
      sources: 'BLS OEWS (wages) + FRED MORTGAGE30US (rate)',
      caveat:
        'Excludes property taxes, insurance, HOA, PMI. Single-earner uses metro median wage; dual-earner multiplies by 1.6x as a typical two-income household proxy.',
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}