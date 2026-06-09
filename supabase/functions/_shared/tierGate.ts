import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from './cors.ts';
import {
  FEATURE_GATES,
  hasFeatureAccess,
  requiredTierFor,
  type FeatureKey,
  type SubscriptionTier,
} from './featureGates.ts';

const VALID: ReadonlySet<SubscriptionTier> = new Set(['free', 'buyer', 'investor']);

function normalizeTier(raw: unknown): SubscriptionTier {
  if (typeof raw === 'string' && VALID.has(raw as SubscriptionTier)) {
    return raw as SubscriptionTier;
  }
  if (raw === 'premium') return 'investor';
  if (raw === 'paid') return 'buyer';
  return 'free';
}

/**
 * Resolve the calling user's subscription tier from the Authorization header.
 * Returns 'free' for anonymous callers or when the profile is missing.
 */
export async function loadUserTier(req: Request): Promise<{
  tier: SubscriptionTier;
  userId: string | null;
}> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return { tier: 'free', userId: null };

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !serviceKey) return { tier: 'free', userId: null };

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const token = authHeader.replace('Bearer ', '');
  const { data: userData, error } = await supabase.auth.getUser(token);
  if (error || !userData.user) return { tier: 'free', userId: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', userData.user.id)
    .maybeSingle();

  return {
    tier: normalizeTier(profile?.subscription_status),
    userId: userData.user.id,
  };
}

/**
 * Enforce that the caller's tier satisfies `feature`. Returns either a
 * `{ tier, userId }` object on success, or `{ error }` containing a 403
 * Response ready to return when access is denied.
 */
export async function enforceFeature(
  req: Request,
  feature: FeatureKey,
): Promise<
  | { ok: true; tier: SubscriptionTier; userId: string | null; error?: undefined }
  | { ok: false; error: Response; tier: SubscriptionTier; userId: string | null }
> {
  const { tier, userId } = await loadUserTier(req);
  if (hasFeatureAccess(tier, feature)) {
    return { ok: true, tier, userId };
  }
  const requiredTier = requiredTierFor(feature);
  const body = JSON.stringify({
    error: 'tier_required',
    feature,
    requiredTier,
    currentTier: tier,
    message: `This feature requires the ${requiredTier === 'investor' ? 'Investor' : 'Buyer'} plan.`,
  });
  return {
    ok: false,
    tier,
    userId,
    error: new Response(body, {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    }),
  };
}

export { FEATURE_GATES, hasFeatureAccess, requiredTierFor };
export type { FeatureKey, SubscriptionTier };