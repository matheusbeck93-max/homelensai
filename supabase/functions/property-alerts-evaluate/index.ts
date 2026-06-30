import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/responses.ts';
import { getErrorMessage } from '../_shared/errors.ts';
import { createLogger } from '../_shared/logging.ts';
import { requireCronAuth } from '../_shared/cronAuth.ts';
import { amortizedBalance, monthsBetween } from '../_shared/rentcast.ts';
import { withCronLog } from '../_shared/cron-log.ts';

const log = createLogger('property-alerts-evaluate');

// Reference current 30-yr fixed market rate (APR %). Tunable via env.
const MARKET_RATE_30YR = Number(Deno.env.get('MARKET_RATE_30YR') ?? '6.85');

type AlertRow = {
  property_id: string;
  alert_type: string;
  severity: 'info' | 'opportunity' | 'warning';
  title: string;
  description: string;
  metadata: Record<string, unknown>;
};

function evalRefi(p: any): AlertRow | null {
  if (!p.has_mortgage || !p.loan_rate_apr || !p.loan_term_years || !p.loan_start_date) return null;
  const spread = Number(p.loan_rate_apr) - MARKET_RATE_30YR;
  if (spread < 0.75) return null;
  return {
    property_id: p.id,
    alert_type: 'refi_opportunity',
    severity: 'opportunity',
    title: `Refi could save ~${spread.toFixed(2)}% APR`,
    description: `Your rate is ${Number(p.loan_rate_apr).toFixed(2)}% vs market ~${MARKET_RATE_30YR.toFixed(2)}%. Worth a refi quote.`,
    metadata: { current_rate: Number(p.loan_rate_apr), market_rate: MARKET_RATE_30YR, spread },
  };
}

function evalHeloc(p: any): AlertRow | null {
  const value = Number(p.current_value_estimate ?? 0);
  if (!value) return null;
  let balance = Number(p.loan_current_balance ?? 0);
  if (p.has_mortgage && p.loan_original_principal && p.loan_rate_apr && p.loan_term_years && p.loan_start_date) {
    const months = monthsBetween(new Date(p.loan_start_date), new Date());
    balance = amortizedBalance(
      Number(p.loan_original_principal),
      Number(p.loan_rate_apr),
      Number(p.loan_term_years),
      months,
    );
  }
  const equity = value - balance;
  const ltv = balance / value;
  if (equity < 50000 || ltv > 0.80) return null;
  const tappable = Math.max(0, value * 0.85 - balance);
  if (tappable < 25000) return null;
  return {
    property_id: p.id,
    alert_type: 'heloc_eligible',
    severity: 'opportunity',
    title: `~$${Math.round(tappable / 1000)}k tappable equity`,
    description: `LTV is ${(ltv * 100).toFixed(0)}%. You likely qualify for a HELOC up to ~$${Math.round(tappable).toLocaleString()}.`,
    metadata: { equity, ltv, tappable_estimate: tappable },
  };
}

function evalRentBelowMarket(p: any, rental: any): AlertRow | null {
  if (!rental?.monthly_rent || !rental?.market_rent_estimate) return null;
  const current = Number(rental.monthly_rent);
  const market = Number(rental.market_rent_estimate);
  if (market <= current * 1.05) return null;
  const gap = market - current;
  return {
    property_id: p.id,
    alert_type: 'rent_below_market',
    severity: 'opportunity',
    title: `Rent ~$${Math.round(gap)}/mo below market`,
    description: `Charging $${current.toLocaleString()}/mo; market est ~$${Math.round(market).toLocaleString()}/mo. Consider a raise at renewal.`,
    metadata: { current_rent: current, market_rent: market, monthly_gap: gap },
  };
}

function evalAppraisalDue(p: any): AlertRow | null {
  const ref = p.current_value_refreshed_at ? new Date(p.current_value_refreshed_at) : null;
  if (!ref) return null;
  const ageDays = (Date.now() - ref.getTime()) / 86400000;
  if (ageDays < 540) return null; // 18 months
  return {
    property_id: p.id,
    alert_type: 'appraisal_due',
    severity: 'info',
    title: 'Valuation older than 18 months',
    description: 'Refresh the auto-valuation or upload a recent appraisal to keep returns accurate.',
    metadata: { last_refreshed_at: p.current_value_refreshed_at, age_days: Math.round(ageDays) },
  };
}

Deno.serve(withCronLog("property-alerts-evaluate-6h", async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  // Allow either cron header OR per-user JWT (for on-demand "re-evaluate now").
  const hasCron = req.headers.get('x-cron-secret');
  let scopedUserId: string | null = null;

  if (hasCron) {
    const cronCheck = requireCronAuth(req);
    if (cronCheck) return cronCheck;
  } else {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return errorResponse('Unauthorized', 401, req);
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return errorResponse('Unauthorized', 401, req);
    scopedUserId = user.id;
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let q = supabase.from('investor_owned_properties').select('*').eq('status', 'active');
    if (scopedUserId) q = q.eq('user_id', scopedUserId);
    const { data: properties, error } = await q;
    if (error) throw error;

    log.step(`Evaluating ${properties?.length ?? 0} properties`);

    let inserted = 0;
    let resolved = 0;

    for (const p of properties ?? []) {
      const { data: rental } = await supabase
        .from('investor_owned_property_rentals')
        .select('*')
        .eq('property_id', p.id)
        .maybeSingle();

      const candidates = [
        evalRefi(p),
        evalHeloc(p),
        p.is_rented ? evalRentBelowMarket(p, rental) : null,
        evalAppraisalDue(p),
      ].filter(Boolean) as AlertRow[];

      const candidateTypes = new Set(candidates.map((c) => c.alert_type));

      // Fetch existing active alerts for this property
      const { data: existing } = await supabase
        .from('investor_owned_property_alerts')
        .select('id, alert_type')
        .eq('property_id', p.id)
        .eq('status', 'active');

      const existingTypes = new Set((existing ?? []).map((a: any) => a.alert_type));

      // Auto-resolve active alerts that no longer match
      for (const a of existing ?? []) {
        if (!candidateTypes.has(a.alert_type)) {
          await supabase
            .from('investor_owned_property_alerts')
            .update({ status: 'expired', dismissed_at: new Date().toISOString() })
            .eq('id', a.id);
          resolved++;
        }
      }

      // Insert new alerts
      for (const c of candidates) {
        if (existingTypes.has(c.alert_type)) continue;
        const { error: insErr } = await supabase
          .from('investor_owned_property_alerts')
          .insert(c);
        if (!insErr) inserted++;
      }
    }

    return jsonResponse({ ok: true, evaluated: properties?.length ?? 0, inserted, resolved }, 200, req);
  } catch (e) {
    log.error('alerts evaluation failed', { error: getErrorMessage(e) });
    return errorResponse(getErrorMessage(e), 500, req);
  }
}));