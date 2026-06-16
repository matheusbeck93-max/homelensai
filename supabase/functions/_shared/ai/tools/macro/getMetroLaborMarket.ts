/**
 * get_metro_labor_market — most-recent LAUS unemployment rate + labor
 * force size for a US metro. Sourced from BLS.
 */

import { getBlsSeries, blsLaus, resolveMsa } from '../../../bls-client.ts';

export const GET_METRO_LABOR_MARKET_TOOL = {
  type: 'function' as const,
  function: {
    name: 'get_metro_labor_market',
    description:
      'Returns the latest local unemployment rate and labor force size for a US metro, sourced from BLS LAUS. Covered metros: top 20 by population (NY, LA, Chicago, Dallas, Houston, DC, Miami, Philadelphia, Atlanta, Phoenix, Boston, SF, Seattle, Denver, Austin, Tampa, Charlotte, Portland, Nashville, Raleigh). Returns ok:false for other metros. Use for "is this a strong job market?" questions.',
    parameters: {
      type: 'object',
      properties: {
        metro_name: { type: 'string', description: 'Metro name, e.g. "Austin" or "Austin, TX". REQUIRED.' },
      },
      required: ['metro_name'],
    },
  },
};

export async function runGetMetroLaborMarket(input: { metro_name?: unknown }) {
  const name = typeof input.metro_name === 'string' ? input.metro_name.trim() : '';
  if (!name) return { ok: false, error: 'metro_name required' };
  const msa = resolveMsa(name);
  if (!msa) {
    return {
      ok: false,
      error: `BLS LAUS coverage limited to top 20 US metros — "${name}" not in current map.`,
    };
  }
  try {
    const series = await getBlsSeries({
      cacheKey: `bls_laus_${msa.code}`,
      seriesIds: [blsLaus.unemploymentRate(msa.code), blsLaus.laborForce(msa.code)],
    });
    const ur = series[blsLaus.unemploymentRate(msa.code)]?.latest;
    const lf = series[blsLaus.laborForce(msa.code)]?.latest;
    return {
      ok: true,
      metro: msa.name,
      unemployment_pct: ur?.value ?? null,
      labor_force: lf?.value ?? null,
      as_of: ur ? `${ur.periodName} ${ur.year}` : null,
      source: 'BLS · LAUS',
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}