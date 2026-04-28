import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from './cors.ts';

/**
 * AI Credits System
 * ------------------
 * - FREE users get DAILY_FREE_CREDITS per UTC day (fixed reset).
 * - 1 credit = 100 tokens (input + output). Always rounded UP.
 * - Per-request guardrail: min 1, max 20 credits charged.
 * - PREMIUM users are unlimited (no precheck, no deduction).
 *
 * Master switch CREDITS_ENFORCED keeps the system OFF until product flips it on.
 * Even when OFF, if a token usage object is provided we still try to log
 * counters (best-effort) so operators can observe usage before enforcement.
 */

export const DAILY_FREE_CREDITS = 100;
export const MAX_OUTPUT_TOKENS_FREE = 600; // ~6 credits cap on output side
export const MIN_CREDITS_PER_REQUEST = 1;
export const MAX_CREDITS_PER_REQUEST = 20;
const TOKENS_PER_CREDIT = 100;

/** Master switch — flip to true to enforce credit limits app-wide. */
const CREDITS_ENFORCED = false;

export interface CreditPrecheckResult {
  allowed: boolean;
  response?: Response;
  userId?: string;
  tier?: 'free' | 'premium' | 'unlimited';
  isAuthenticated: boolean;
  creditsRemaining?: number;
  enforced: boolean;
}

export interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

function tokensToCredits(totalTokens: number): number {
  if (!Number.isFinite(totalTokens) || totalTokens <= 0) return MIN_CREDITS_PER_REQUEST;
  const raw = Math.ceil(totalTokens / TOKENS_PER_CREDIT);
  return Math.min(MAX_CREDITS_PER_REQUEST, Math.max(MIN_CREDITS_PER_REQUEST, raw));
}

function getServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, serviceKey);
}

/**
 * Run BEFORE calling the model. Verifies the user has at least 1 credit left.
 * - Unauthenticated → 401 (no quota consumed).
 * - Premium → allowed, no counter.
 * - Free w/ remaining > 0 → allowed (actual deduction happens after the call).
 * - Free w/ no remaining AND CREDITS_ENFORCED → 429 paywall response.
 */
export async function precheckAiCredits(req: Request): Promise<CreditPrecheckResult> {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader) {
    return {
      allowed: false,
      isAuthenticated: false,
      enforced: CREDITS_ENFORCED,
      response: new Response(
        JSON.stringify({
          error: 'auth_required',
          message: 'Please sign in to HomeLens to use the assistant.',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      ),
    };
  }

  const supabase = getServiceClient();
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) {
    return {
      allowed: false,
      isAuthenticated: false,
      enforced: CREDITS_ENFORCED,
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
    .select('subscription_status, ai_credits_used_today, ai_credits_last_reset')
    .eq('id', user.id)
    .maybeSingle();

  const tier = (profile?.subscription_status || 'free') as 'free' | 'premium';

  if (tier === 'premium') {
    return { allowed: true, userId: user.id, tier: 'premium', isAuthenticated: true, enforced: CREDITS_ENFORCED };
  }

  // Free tier — daily reset (UTC date).
  const today = new Date().toISOString().split('T')[0];
  const lastReset = (profile as any)?.ai_credits_last_reset as string | undefined;
  let usedToday = (profile as any)?.ai_credits_used_today ?? 0;

  if (lastReset !== today) {
    usedToday = 0;
    await supabase
      .from('profiles')
      .update({ ai_credits_used_today: 0, ai_credits_last_reset: today })
      .eq('id', user.id);
  }

  const remaining = Math.max(0, DAILY_FREE_CREDITS - usedToday);

  if (remaining <= 0 && CREDITS_ENFORCED) {
    return {
      allowed: false,
      isAuthenticated: true,
      userId: user.id,
      tier: 'free',
      enforced: true,
      creditsRemaining: 0,
      response: new Response(
        JSON.stringify({
          error: 'ai_credits_exhausted',
          message: "You've reached your daily AI limit. Upgrade to continue instantly.",
          limitReached: true,
          creditsRemaining: 0,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      ),
    };
  }

  return {
    allowed: true,
    userId: user.id,
    tier: 'free',
    isAuthenticated: true,
    enforced: CREDITS_ENFORCED,
    creditsRemaining: remaining,
  };
}

/**
 * Run AFTER a successful model call. Converts token usage into credits and
 * increments the daily counter for free users. Premium and unauthenticated
 * paths are no-ops. Errors are swallowed (best-effort) so they never break
 * the user-facing response.
 */
export async function deductAiCredits(
  precheck: CreditPrecheckResult,
  usage: TokenUsage | undefined | null,
): Promise<{ chargedCredits: number; remaining: number | null }> {
  if (!precheck.userId || precheck.tier === 'premium') {
    return { chargedCredits: 0, remaining: null };
  }

  const totalTokens =
    usage?.total_tokens ??
    ((usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0));

  const credits = tokensToCredits(totalTokens || 0);

  try {
    const supabase = getServiceClient();
    const today = new Date().toISOString().split('T')[0];
    const { data: profile } = await supabase
      .from('profiles')
      .select('ai_credits_used_today, ai_credits_last_reset')
      .eq('id', precheck.userId)
      .maybeSingle();

    const lastReset = (profile as any)?.ai_credits_last_reset as string | undefined;
    const baseUsed = lastReset === today ? ((profile as any)?.ai_credits_used_today ?? 0) : 0;
    const newUsed = baseUsed + credits;

    await supabase
      .from('profiles')
      .update({ ai_credits_used_today: newUsed, ai_credits_last_reset: today })
      .eq('id', precheck.userId);

    return {
      chargedCredits: credits,
      remaining: Math.max(0, DAILY_FREE_CREDITS - newUsed),
    };
  } catch (err) {
    console.error('[aiCredits] deduct failed', err);
    return { chargedCredits: credits, remaining: null };
  }
}

/** Output-token cap to apply when calling the LLM for FREE users. */
export function maxOutputTokensFor(tier: 'free' | 'premium' | 'unlimited' | undefined): number | undefined {
  if (tier === 'premium' || tier === 'unlimited') return undefined;
  return MAX_OUTPUT_TOKENS_FREE;
}

export const CREDITS_CONFIG = {
  DAILY_FREE_CREDITS,
  MAX_OUTPUT_TOKENS_FREE,
  MIN_CREDITS_PER_REQUEST,
  MAX_CREDITS_PER_REQUEST,
  TOKENS_PER_CREDIT,
  CREDITS_ENFORCED,
};
