// Integration test: verifies BLS labor + wage tools return populated data
// for a known covered metro (Tampa). These are the exact tools that feed
// `macro_context.target_market_labor` and `target_market_wage` in the
// investor brief prompt, so a green test = brief will receive the data.
//
// Requires BLS_API_KEY and FRED_API_KEY to be set in the test runner env
// (Supabase test runner injects project secrets automatically).
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { runGetMetroLaborMarket } from '../_shared/ai/tools/macro/getMetroLaborMarket.ts';
import { runGetMetroWageGrowth } from '../_shared/ai/tools/macro/getMetroWageGrowth.ts';

const METRO = 'Tampa';

// The BLS client reads/writes the bls_cache table via service role. Skip
// gracefully when the env doesn't expose those (e.g. local runs without
// service-role access) so this file never becomes a false CI failure.
const HAS_BACKEND =
  !!Deno.env.get('SUPABASE_URL') &&
  !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') &&
  !!Deno.env.get('BLS_API_KEY') &&
  !!Deno.env.get('FRED_API_KEY');

Deno.test({
  name: 'investor-brief macro_context: BLS labor block is populated for Tampa',
  ignore: !HAS_BACKEND,
  fn: async () => {
  const labor = await runGetMetroLaborMarket({ metro_name: METRO });
  assertEquals((labor as { ok: boolean }).ok, true, `labor tool failed: ${JSON.stringify(labor)}`);
  const l = labor as { metro: string; unemployment_pct: number | null; labor_force: number | null };
  assert(l.metro.toLowerCase().includes('tampa'), `unexpected metro: ${l.metro}`);
  assert(typeof l.unemployment_pct === 'number', 'unemployment_pct must be numeric');
  assert(typeof l.labor_force === 'number', 'labor_force must be numeric');
  },
});

Deno.test({
  name: 'investor-brief macro_context: BLS wage-growth block is populated for Tampa',
  ignore: !HAS_BACKEND,
  fn: async () => {
  const wage = await runGetMetroWageGrowth({ metro_name: METRO });
  assertEquals((wage as { ok: boolean }).ok, true, `wage tool failed: ${JSON.stringify(wage)}`);
  const w = wage as {
    metro: string;
    current_median_wage_usd: number | null;
    wage_yoy_pct: number | null;
    wage_vs_price_gap_pp: number | null;
  };
  assert(w.metro.toLowerCase().includes('tampa'), `unexpected metro: ${w.metro}`);
  assert(typeof w.current_median_wage_usd === 'number', 'current_median_wage_usd must be numeric');
  assert(
    w.wage_yoy_pct !== null || w.wage_vs_price_gap_pp !== null,
    'at least one of wage_yoy_pct or wage_vs_price_gap_pp must be non-null',
  );
  },
});