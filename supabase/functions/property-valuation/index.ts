import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { getSupabaseEnv } from '../_shared/env.ts';
import { fetchRentcastValuation, amortizedBalance, monthsBetween } from '../_shared/rentcast.ts';

const RATE_LIMIT_MS = 60 * 60 * 1000; // 1/hr per property

Deno.serve(async (req) => {
  const pre = handleCors(req);
  if (pre) return pre;

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const propertyId = body?.property_id;
    if (!propertyId || typeof propertyId !== 'string') {
      return new Response(JSON.stringify({ error: 'property_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { url, serviceRoleKey } = getSupabaseEnv();
    const admin = createClient(url, serviceRoleKey);

    const { data: prop, error: pErr } = await admin
      .from('investor_owned_properties')
      .select('*')
      .eq('id', propertyId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (pErr || !prop) {
      return new Response(JSON.stringify({ error: 'Property not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit: 1/hr unless force=true
    if (!body?.force && prop.current_value_refreshed_at) {
      const last = new Date(prop.current_value_refreshed_at).getTime();
      if (Date.now() - last < RATE_LIMIT_MS) {
        return new Response(
          JSON.stringify({
            error: 'Rate limited',
            message: 'Valuation can be refreshed once per hour. Try again later.',
            next_allowed_at: new Date(last + RATE_LIMIT_MS).toISOString(),
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Honor manual override expiry
    const overrideActive =
      prop.current_value_manual_override != null &&
      (!prop.current_value_manual_expires_at ||
        new Date(prop.current_value_manual_expires_at) > new Date());
    if (overrideActive && !body?.force) {
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: 'Manual override is active. Clear it or pass force=true to refresh anyway.',
          value: prop.current_value_manual_override,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const valuation = await fetchRentcastValuation({
      address_line1: prop.address_line1,
      city: prop.city,
      state: prop.state,
      zip: prop.zip,
      property_type: prop.property_type,
      beds: prop.beds,
      baths: prop.baths != null ? Number(prop.baths) : null,
      sqft: prop.sqft,
    });

    if (!valuation.saleValue) {
      return new Response(
        JSON.stringify({
          error: 'No valuation available',
          message: 'RentCast could not produce a value for this address.',
          raw: valuation.raw,
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Recompute loan balance opportunistically.
    const updates: Record<string, any> = {
      current_value_estimate: valuation.saleValue,
      current_value_source: 'rentcast',
      current_value_confidence_low: valuation.saleValueLow,
      current_value_confidence_high: valuation.saleValueHigh,
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
      const bal = amortizedBalance(
        Number(prop.loan_original_principal),
        Number(prop.loan_rate_apr),
        Number(prop.loan_term_years),
        months,
      );
      updates.loan_current_balance = bal;
      updates.loan_current_balance_as_of = new Date().toISOString().slice(0, 10);
    }

    await admin.from('investor_owned_properties').update(updates).eq('id', propertyId);
    await admin.from('investor_owned_property_valuations').insert({
      property_id: propertyId,
      value: valuation.saleValue,
      source: 'rentcast',
      confidence_low: valuation.saleValueLow,
      confidence_high: valuation.saleValueHigh,
      source_payload: valuation.raw as any,
    });

    return new Response(
      JSON.stringify({ ok: true, valuation, loan_balance: updates.loan_current_balance ?? null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});