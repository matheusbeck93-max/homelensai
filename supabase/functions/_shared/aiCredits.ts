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
const CREDITS_ENFORCED = true;

export interface CreditPrecheckResult {
  allowed: boolean;
  response?: Response;
  userId?: string;
  tier?: 'free' | 'premium' | 'unlimited';
  isAuthenticated: boolean;
  creditsRemaining?: number;
  enforced: boolean;
  functionName?: string;
  requestId?: string;
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

function inferFunctionName(req: Request): string {
  try {
    const path = new URL(req.url).pathname;
    const parts = path.split('/').filter(Boolean);
    // Edge function URLs look like /functions/v1/<name>
    return parts[parts.length - 1] || 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Best-effort write to ai_credit_ledger. Never throws. */
async function writeLedger(entry: {
  userId: string;
  functionName: string;
  eventType: 'precheck' | 'deduct' | 'reset' | 'block';
  creditsCharged?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  balanceBefore?: number;
  balanceAfter?: number;
  model?: string;
  requestId?: string;
  note?: string;
}) {
  try {
    const supabase = getServiceClient();
    await supabase.from('ai_credit_ledger').insert({
      user_id: entry.userId,
      function_name: entry.functionName,
      event_type: entry.eventType,
      credits_charged: entry.creditsCharged ?? 0,
      prompt_tokens: entry.promptTokens ?? null,
      completion_tokens: entry.completionTokens ?? null,
      total_tokens: entry.totalTokens ?? null,
      balance_before: entry.balanceBefore ?? null,
      balance_after: entry.balanceAfter ?? null,
      model: entry.model ?? null,
      request_id: entry.requestId ?? null,
      note: entry.note ?? null,
    });
  } catch (err) {
    console.error('[aiCredits] ledger write failed', err);
  }
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
  const functionName = inferFunctionName(req);
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();

  if (!authHeader) {
    console.log(JSON.stringify({
      scope: 'aiCredits.precheck',
      functionName,
      requestId,
      result: 'unauthenticated',
    }));
    return {
      allowed: false,
      isAuthenticated: false,
      enforced: CREDITS_ENFORCED,
      functionName,
      requestId,
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
    console.log(JSON.stringify({
      scope: 'aiCredits.precheck',
      functionName,
      requestId,
      result: 'invalid_token',
    }));
    return {
      allowed: false,
      isAuthenticated: false,
      enforced: CREDITS_ENFORCED,
      functionName,
      requestId,
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
    console.log(JSON.stringify({
      scope: 'aiCredits.precheck',
      functionName,
      requestId,
      userId: user.id,
      tier: 'premium',
      result: 'allowed_unlimited',
    }));
    return { allowed: true, userId: user.id, tier: 'premium', isAuthenticated: true, enforced: CREDITS_ENFORCED, functionName, requestId };
  }

  // Free tier — daily reset (UTC date).
  const today = new Date().toISOString().split('T')[0];
  const lastReset = (profile as any)?.ai_credits_last_reset as string | undefined;
  let usedToday = (profile as any)?.ai_credits_used_today ?? 0;
  let didReset = false;

  if (lastReset !== today) {
    usedToday = 0;
    didReset = true;
    await supabase
      .from('profiles')
      .update({ ai_credits_used_today: 0, ai_credits_last_reset: today })
      .eq('id', user.id);
    await writeLedger({
      userId: user.id,
      functionName,
      eventType: 'reset',
      balanceBefore: DAILY_FREE_CREDITS,
      balanceAfter: DAILY_FREE_CREDITS,
      requestId,
      note: `daily reset (prev=${lastReset ?? 'null'} -> ${today})`,
    });
  }

  const remaining = Math.max(0, DAILY_FREE_CREDITS - usedToday);

  if (remaining <= 0 && CREDITS_ENFORCED) {
    console.log(JSON.stringify({
      scope: 'aiCredits.precheck',
      functionName,
      requestId,
      userId: user.id,
      tier: 'free',
      result: 'blocked_exhausted',
      remaining: 0,
    }));
    await writeLedger({
      userId: user.id,
      functionName,
      eventType: 'block',
      balanceBefore: 0,
      balanceAfter: 0,
      requestId,
      note: 'daily limit reached',
    });
    return {
      allowed: false,
      isAuthenticated: true,
      userId: user.id,
      tier: 'free',
      enforced: true,
      creditsRemaining: 0,
      functionName,
      requestId,
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

  console.log(JSON.stringify({
    scope: 'aiCredits.precheck',
    functionName,
    requestId,
    userId: user.id,
    tier: 'free',
    result: 'allowed',
    remaining,
    didReset,
  }));
  await writeLedger({
    userId: user.id,
    functionName,
    eventType: 'precheck',
    balanceBefore: remaining,
    balanceAfter: remaining,
    requestId,
    note: didReset ? 'after daily reset' : undefined,
  });

  return {
    allowed: true,
    userId: user.id,
    tier: 'free',
    isAuthenticated: true,
    enforced: CREDITS_ENFORCED,
    creditsRemaining: remaining,
    functionName,
    requestId,
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
  meta?: { model?: string },
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

    const balanceBefore = Math.max(0, DAILY_FREE_CREDITS - baseUsed);
    const balanceAfter = Math.max(0, DAILY_FREE_CREDITS - newUsed);

    console.log(JSON.stringify({
      scope: 'aiCredits.deduct',
      functionName: precheck.functionName,
      requestId: precheck.requestId,
      userId: precheck.userId,
      tier: precheck.tier,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens,
      creditsCharged: credits,
      balanceBefore,
      balanceAfter,
      model: meta?.model,
    }));

    await writeLedger({
      userId: precheck.userId,
      functionName: precheck.functionName ?? 'unknown',
      eventType: 'deduct',
      creditsCharged: credits,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: totalTokens || 0,
      balanceBefore,
      balanceAfter,
      model: meta?.model,
      requestId: precheck.requestId,
    });

    return {
      chargedCredits: credits,
      remaining: balanceAfter,
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
