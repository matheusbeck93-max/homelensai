import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { ALL_RULES } from './registry.ts';
import type {
  MilestoneEvent,
  UserContext,
  OwnedPropertySnapshot,
  SavedPropertySnapshot,
  MarketStatSnapshot,
} from './types.ts';

type Tier = 'free' | 'buyer' | 'investor';

function normalizeTier(raw: unknown): Tier {
  if (raw === 'buyer' || raw === 'investor' || raw === 'free') return raw;
  if (raw === 'premium') return 'investor';
  if (raw === 'paid') return 'buyer';
  return 'free';
}

function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );
}

export async function loadUserContext(userId: string): Promise<UserContext | null> {
  const sb = adminClient();

  const { data: profile } = await sb
    .from('profiles')
    .select('id, full_name, created_at, subscription_status, preferred_cities')
    .eq('id', userId)
    .maybeSingle();
  if (!profile) return null;

  const tier = normalizeTier(profile.subscription_status);

  const [ownedRes, savedRes, analysesRes] = await Promise.all([
    sb
      .from('investor_owned_properties')
      .select(
        'id, address_line1, city, state, purchase_date, purchase_price, current_value_estimate, loan_original_principal, loan_current_balance, primary_photo_url, status',
      )
      .eq('user_id', userId)
      .neq('status', 'sold'),
    sb
      .from('saved_properties')
      .select('id, property_address, city, state, price, created_at')
      .eq('user_id', userId),
    sb
      .from('analyses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);

  const owned: OwnedPropertySnapshot[] = (ownedRes.data ?? []).map((p: any) => ({
    id: p.id,
    address: p.address_line1 ?? '',
    city: p.city,
    state: p.state,
    purchaseDate: p.purchase_date,
    purchasePrice: p.purchase_price ? Number(p.purchase_price) : null,
    currentValue: p.current_value_estimate ? Number(p.current_value_estimate) : null,
    loanOriginalPrincipal: p.loan_original_principal ? Number(p.loan_original_principal) : null,
    loanCurrentBalance: p.loan_current_balance ? Number(p.loan_current_balance) : null,
    primaryPhotoUrl: p.primary_photo_url,
  }));

  const saved: SavedPropertySnapshot[] = (savedRes.data ?? []).map((s: any) => ({
    id: s.id,
    address: s.property_address ?? null,
    city: s.city ?? null,
    state: s.state ?? null,
    listPrice: s.price ? Number(s.price) : null,
    savedAt: s.created_at,
    lastSeenPrice: null,
  }));

  const preferredCities: string[] = Array.isArray(profile.preferred_cities)
    ? (profile.preferred_cities as string[])
    : [];

  let marketStats: MarketStatSnapshot[] = [];
  if (preferredCities.length > 0) {
    const { data: ms } = await sb
      .from('market_stats')
      .select('city, state, median_list_price, appreciation_yoy, refreshed_at')
      .in('city', preferredCities)
      .order('refreshed_at', { ascending: false })
      .limit(50);
    marketStats = (ms ?? []).map((m: any) => ({
      city: m.city,
      state: m.state,
      medianListPrice: m.median_list_price ? Number(m.median_list_price) : null,
      appreciationYoy: m.appreciation_yoy ? Number(m.appreciation_yoy) : null,
      refreshedAt: m.refreshed_at,
    }));
  }

  return {
    userId,
    tier,
    createdAt: profile.created_at,
    ownedProperties: owned,
    savedProperties: saved,
    marketStats,
    analysesCount: analysesRes.count ?? 0,
    preferredCities,
    fullName: profile.full_name ?? null,
  };
}

/**
 * Tier gate: portfolio milestones require at least one owned property
 * (which in practice means buyer/investor). All other categories are
 * available to every tier.
 */
function isCategoryEligible(category: string, ctx: UserContext): boolean {
  if (category === 'property') return ctx.ownedProperties.length > 0;
  return true;
}

export interface DetectorResult {
  events: MilestoneEvent[];
  inserted: number;
}

export async function detectAndPersist(userId: string): Promise<DetectorResult> {
  const ctx = await loadUserContext(userId);
  if (!ctx) return { events: [], inserted: 0 };

  const candidates: MilestoneEvent[] = [];
  for (const rule of ALL_RULES) {
    if (!isCategoryEligible(rule.category, ctx)) continue;
    try {
      candidates.push(...rule.evaluate(ctx));
    } catch (err) {
      console.error(`[milestones] rule ${rule.id} failed`, err);
    }
  }
  if (candidates.length === 0) return { events: [], inserted: 0 };

  const sb = adminClient();
  const keys = candidates.map((e) => ({ milestone_id: e.milestoneId, subject_id: e.subjectId }));
  const { data: existing } = await sb
    .from('delivered_milestones')
    .select('milestone_id, subject_id')
    .eq('user_id', userId)
    .in(
      'milestone_id',
      Array.from(new Set(keys.map((k) => k.milestone_id))),
    );
  const have = new Set(
    (existing ?? []).map((e: any) => `${e.milestone_id}::${e.subject_id ?? ''}`),
  );
  const fresh = candidates.filter(
    (e) => !have.has(`${e.milestoneId}::${e.subjectId}`),
  );
  if (fresh.length === 0) return { events: [], inserted: 0 };

  const rows = fresh.map((e) => ({
    user_id: userId,
    milestone_id: e.milestoneId,
    subject_id: e.subjectId,
    category: e.category,
    severity: e.severity,
    headline: e.headline,
    context: e.context ?? null,
    metadata: e.metadata ?? {},
    delivered_in_app: true,
  }));
  const { error } = await sb.from('delivered_milestones').insert(rows);
  if (error) {
    console.error('[milestones] insert failed', error);
    return { events: [], inserted: 0 };
  }
  return { events: fresh, inserted: fresh.length };
}