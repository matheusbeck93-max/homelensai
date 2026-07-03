import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { requireCronAuth } from '../_shared/cronAuth.ts';
import { getSupabaseEnv } from '../_shared/env.ts';
import { fetchRentcastValuation, amortizedBalance, monthsBetween } from '../_shared/rentcast.ts';
import { withCronLog } from '../_shared/cron-log.ts';
import { withRequestOrigin } from "../_shared/ai/requestContext.ts";

const STALE_HOURS = 24;
const BATCH_LIMIT = 50;

Deno.serve((req: Request) => withRequestOrigin(req, () => (withCronLog("property-valuation-refresh-hourly", async (req) => {
  const pre = handleCors(req);
  if (pre) return pre;

  const authFail = requireCronAuth(req);
  if (authFail) return authFail;

  const { url, serviceRoleKey } = getSupabaseEnv();
  const admin = createClient(url, serviceRoleKey);

  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();

  const { data: props, error } = await admin
    .from('investor_owned_properties')
    .select('*')
    .eq('status', 'active')
    .eq('auto_refresh_enabled', true)
    .or(`current_value_refreshed_at.is.null,current_value_refreshed_at.lt.${cutoff}`)
    .limit(BATCH_LIMIT);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results: Array<{ id: string; ok: boolean; error?: string; value?: number }> = [];

  for (const prop of props ?? []) {
    try {
      // Skip active manual overrides
      const overrideActive =
        prop.current_value_manual_override != null &&
        (!prop.current_value_manual_expires_at ||
          new Date(prop.current_value_manual_expires_at) > new Date());
      if (overrideActive) {
        results.push({ id: prop.id, ok: true, value: prop.current_value_manual_override });
        continue;
      }

      const v = await fetchRentcastValuation({
        address_line1: prop.address_line1,
        city: prop.city,
        state: prop.state,
        zip: prop.zip,
        property_type: prop.property_type,
        beds: prop.beds,
        baths: prop.baths != null ? Number(prop.baths) : null,
        sqft: prop.sqft,
      });

      if (!v.saleValue) {
        results.push({ id: prop.id, ok: false, error: 'no value' });
        continue;
      }

      const updates: Record<string, any> = {
        current_value_estimate: v.saleValue,
        current_value_source: 'rentcast',
        current_value_confidence_low: v.saleValueLow,
        current_value_confidence_high: v.saleValueHigh,
        current_value_refreshed_at: new Date().toISOString(),
      };
      if (
        prop.has_mortgage &&
        prop.loan_original_principal &&
        prop.loan_rate_apr &&
        prop.loan_term_years &&
        prop.loan_start_date
      ) {
        const months = monthsBetween(prop.loan_start_date);
        updates.loan_current_balance = amortizedBalance(
          Number(prop.loan_original_principal),
          Number(prop.loan_rate_apr),
          Number(prop.loan_term_years),
          months,
        );
        updates.loan_current_balance_as_of = new Date().toISOString().slice(0, 10);
      }

      await admin.from('investor_owned_properties').update(updates).eq('id', prop.id);
      await admin.from('investor_owned_property_valuations').insert({
        property_id: prop.id,
        value: v.saleValue,
        source: 'rentcast',
        confidence_low: v.saleValueLow,
        confidence_high: v.saleValueHigh,
        source_payload: v.raw as any,
      });
      results.push({ id: prop.id, ok: true, value: v.saleValue });
    } catch (e) {
      results.push({ id: prop.id, ok: false, error: String((e as Error)?.message ?? e) });
    }
  }

  return new Response(
    JSON.stringify({
      processed: results.length,
      ok: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}))(req)));