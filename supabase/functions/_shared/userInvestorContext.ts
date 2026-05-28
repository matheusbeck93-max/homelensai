import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

/**
 * Shared loader for the authenticated user's investor-side context:
 * profile preferences + owned properties + saved analyses + saved properties.
 *
 * Used by `investor-chat`, `perplexity-chat`, and `ai-chat` so every chat
 * surface has the same baseline knowledge of who the user is and what
 * they've already saved.
 *
 * Memoized per `Request` (like `profileLoader`) so multiple call sites in
 * one handler share a single round trip.
 */

export interface UserInvestorContext {
  profile: any | null;
  savedAnalyses: any[];
  savedProperties: any[];
  ownedProperties: any[];
}

const EMPTY: UserInvestorContext = {
  profile: null,
  savedAnalyses: [],
  savedProperties: [],
  ownedProperties: [],
};

const cache = new WeakMap<Request, Promise<UserInvestorContext>>();

export function loadUserInvestorContext(req: Request): Promise<UserInvestorContext> {
  const cached = cache.get(req);
  if (cached) return cached;

  const promise = (async (): Promise<UserInvestorContext> => {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return EMPTY;
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return EMPTY;

    try {
      const client = createClient(supabaseUrl, serviceKey);
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await client.auth.getUser(token);
      if (!user) return EMPTY;

      const [profileRes, anRes, savedRes, ownedRes] = await Promise.all([
        client
          .from('profiles')
          .select(
            'primary_goal, investment_strategy, investment_strategies, financing_preference, financing_preferences, hold_period_years, buyer_type, buyer_types, budget_min, budget_max, max_price_range, desired_monthly_payment, cash_available, preferred_cities, location_preferences, property_types, min_bedrooms, min_bathrooms, min_sqft, max_sqft, must_have_features, risk_level, about_me, brief_cadence, brief_card_count, financing_defaults',
          )
          .eq('id', user.id)
          .maybeSingle(),
        client
          .from('saved_analyses')
          .select('property_address, property_price, investment_score, score_label, analysis_summary, source, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8),
        client
          .from('saved_properties')
          .select('property_address, city, state, property_url, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(15),
        client
          .from('investor_owned_properties')
          .select('address_line1, city, state, zip, property_type, beds, baths, sqft, purchase_date, purchase_price, has_mortgage, loan_original_principal, loan_rate_apr, loan_term_years')
          .eq('user_id', user.id)
          .limit(15),
      ]);
      return {
        profile: profileRes?.data ?? null,
        savedAnalyses: anRes?.data ?? [],
        savedProperties: savedRes?.data ?? [],
        ownedProperties: ownedRes?.data ?? [],
      };
    } catch (e) {
      console.error('[userInvestorContext] load error:', e);
      return EMPTY;
    }
  })();

  cache.set(req, promise);
  return promise;
}

/**
 * Render the loaded context as a plain-text block to append to a system
 * prompt. Returns '' when there's nothing meaningful to add.
 */
export function buildUserInvestorContextBlock(ctx: UserInvestorContext): string {
  const p = ctx.profile ?? {};
  const hasAnyProfileField = ctx.profile && Object.values(ctx.profile).some(
    (v) => v != null && (Array.isArray(v) ? v.length > 0 : v !== ''),
  );
  const hasAnything =
    hasAnyProfileField ||
    ctx.ownedProperties.length > 0 ||
    ctx.savedAnalyses.length > 0 ||
    ctx.savedProperties.length > 0;
  if (!hasAnything) return '';

  const lines: string[] = [];
  lines.push('\n\n=== USER INVESTOR CONTEXT (always available, do not ask for these) ===');
  lines.push('Preferences:');
  if (p.primary_goal) lines.push(`- Primary goal: ${p.primary_goal}`);
  if (p.buyer_types?.length || p.buyer_type) lines.push(`- Buyer type(s): ${(p.buyer_types ?? [p.buyer_type]).filter(Boolean).join(', ')}`);
  if (p.investment_strategies?.length || p.investment_strategy) lines.push(`- Strategy: ${(p.investment_strategies ?? [p.investment_strategy]).filter(Boolean).join(', ')}`);
  if (p.hold_period_years) lines.push(`- Hold period: ${p.hold_period_years} yrs`);
  if (p.financing_preferences?.length || p.financing_preference) lines.push(`- Financing: ${(p.financing_preferences ?? [p.financing_preference]).filter(Boolean).join(', ')}`);
  if (p.cash_available != null) lines.push(`- Cash available: $${Number(p.cash_available).toLocaleString()}`);
  if (p.budget_min != null || p.budget_max != null || p.max_price_range != null) {
    lines.push(`- Budget: ${p.budget_min ? `$${Number(p.budget_min).toLocaleString()}` : '—'} to ${p.budget_max ? `$${Number(p.budget_max).toLocaleString()}` : p.max_price_range ? `$${Number(p.max_price_range).toLocaleString()}` : '—'}`);
  }
  if (p.desired_monthly_payment) lines.push(`- Target monthly payment: $${Number(p.desired_monthly_payment).toLocaleString()}`);
  if (p.preferred_cities?.length) lines.push(`- Target cities: ${p.preferred_cities.join(', ')}`);
  if (Array.isArray(p.location_preferences) && p.location_preferences.length) {
    lines.push(`- Location preferences: ${JSON.stringify(p.location_preferences).slice(0, 400)}`);
  }
  if (p.property_types?.length) lines.push(`- Property types: ${p.property_types.join(', ')}`);
  if (p.min_bedrooms || p.min_bathrooms || p.min_sqft || p.max_sqft) {
    lines.push(`- Requirements: ${p.min_bedrooms ?? '?'}+ bd, ${p.min_bathrooms ?? '?'}+ ba, ${p.min_sqft ?? '?'}–${p.max_sqft ?? '?'} sqft`);
  }
  if (p.must_have_features?.length) lines.push(`- Must-have features: ${p.must_have_features.join(', ')}`);
  if (p.risk_level) lines.push(`- Risk level: ${p.risk_level}`);
  if (p.financing_defaults) lines.push(`- Financing defaults: ${JSON.stringify(p.financing_defaults)}`);
  if (p.about_me) lines.push(`- About: ${String(p.about_me).slice(0, 500)}`);

  lines.push(`\nMy Properties (${ctx.ownedProperties.length}):`);
  if (ctx.ownedProperties.length === 0) lines.push('- none');
  else {
    for (const o of ctx.ownedProperties.slice(0, 10)) {
      lines.push(`- ${o.address_line1}, ${o.city}, ${o.state} ${o.zip} · ${o.property_type} · ${o.beds ?? '?'}bd/${o.baths ?? '?'}ba · purchased ${o.purchase_date} @ $${Number(o.purchase_price ?? 0).toLocaleString()}${o.has_mortgage ? ` · loan ${o.loan_rate_apr ? Number(o.loan_rate_apr) * 100 : '?'}% / ${o.loan_term_years ?? '?'}yr` : ''}`);
    }
  }

  lines.push(`\nSaved Analyses (${ctx.savedAnalyses.length}):`);
  if (ctx.savedAnalyses.length === 0) lines.push('- none');
  else {
    for (const a of ctx.savedAnalyses.slice(0, 6)) {
      lines.push(`- ${a.property_address ?? '—'} · ${a.property_price ? `$${Number(a.property_price).toLocaleString()}` : ''} · score ${a.investment_score ?? '?'}/100${a.score_label ? ` (${a.score_label})` : ''} · src ${a.source}`);
    }
  }

  lines.push(`\nSaved Properties (${ctx.savedProperties.length}):`);
  if (ctx.savedProperties.length === 0) lines.push('- none');
  else {
    for (const s of ctx.savedProperties.slice(0, 10)) {
      lines.push(`- ${s.property_address}${s.city ? `, ${s.city}` : ''}${s.state ? `, ${s.state}` : ''}`);
    }
  }
  lines.push('=== END USER INVESTOR CONTEXT ===');
  return lines.join('\n');
}