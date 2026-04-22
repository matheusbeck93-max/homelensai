import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from './cors.ts';

const DAILY_FREE_LIMIT = 3;

export interface DailyLimitResult {
  allowed: boolean;
  response?: Response;
  userId?: string;
  tier?: string;
  isAuthenticated: boolean;
}

/**
 * Enforce the same daily AI usage limit the app uses (3/day for free, unlimited for premium).
 * Reads/writes profiles.daily_analysis_count and daily_analysis_last_reset.
 *
 * Behavior:
 * - No Authorization header → returns 401 { error: 'auth_required' } (does NOT consume quota).
 * - Premium user → allowed, no increment.
 * - Free user under limit → increments count, allowed.
 * - Free user at/over limit → returns 429 { limitReached: true }.
 */
export async function enforceDailyLimit(req: Request): Promise<DailyLimitResult> {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return {
      allowed: false,
      isAuthenticated: false,
      response: new Response(
        JSON.stringify({
          error: 'auth_required',
          message: 'Please sign in to HomeLens to use the assistant.',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      ),
    };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const token = authHeader.replace('Bearer ', '');

  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) {
    return {
      allowed: false,
      isAuthenticated: false,
      response: new Response(
        JSON.stringify({
          error: 'auth_required',
          message: 'Session expired. Please sign in again.',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      ),
    };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, daily_analysis_count, daily_analysis_last_reset')
    .eq('id', user.id)
    .maybeSingle();

  const tier = profile?.subscription_status || 'free';

  // Premium → unlimited, no increment.
  if (tier === 'premium') {
    return { allowed: true, userId: user.id, tier, isAuthenticated: true };
  }

  // Free tier: reset if needed, then check + increment.
  const today = new Date().toISOString().split('T')[0];
  const lastReset = profile?.daily_analysis_last_reset;
  let currentCount = profile?.daily_analysis_count ?? 0;

  if (lastReset !== today) {
    currentCount = 0;
    await supabase
      .from('profiles')
      .update({ daily_analysis_count: 0, daily_analysis_last_reset: today })
      .eq('id', user.id);
  }

  if (currentCount >= DAILY_FREE_LIMIT) {
    return {
      allowed: false,
      isAuthenticated: true,
      userId: user.id,
      tier,
      response: new Response(
        JSON.stringify({
          error: 'Daily analysis limit reached',
          message: `You have reached your daily limit of ${DAILY_FREE_LIMIT} AI analyses. Upgrade to Premium for unlimited access.`,
          limitReached: true,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      ),
    };
  }

  await supabase
    .from('profiles')
    .update({ daily_analysis_count: currentCount + 1 })
    .eq('id', user.id);

  return { allowed: true, userId: user.id, tier, isAuthenticated: true };
}
