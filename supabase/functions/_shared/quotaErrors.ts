/**
 * Quota / budget error standardization (PR #6).
 *
 * Every AI-backed edge function should funnel BudgetExceededError and
 * FeatureQuotaExceededError through these helpers so the frontend (PR #7)
 * has ONE shape to parse:
 *
 *   HTTP 402
 *   {
 *     code: "BUDGET_EXCEEDED" | "QUOTA_EXCEEDED",
 *     message: string,
 *     upgradeUrl: string,
 *     ...rich budget payload (when BUDGET_EXCEEDED)
 *     feature, tier (when QUOTA_EXCEEDED)
 *   }
 *
 * For SSE endpoints, `quotaErrorSseEvent` returns a terminal SSE chunk
 * (`event: quota_exceeded\ndata: {...}`) so the client can render
 * <BudgetCapBlocker /> even when the cap trips mid-stream.
 */

import { BudgetExceededError } from './ai/router.ts';
import { FeatureQuotaExceededError } from './usage-gate.ts';
import { buildBudgetExceededPayload } from './ai/budgetGuard.ts';
import { corsHeaders, buildCorsHeaders } from './cors.ts';

export type QuotaCode = 'BUDGET_EXCEEDED' | 'QUOTA_EXCEEDED';

export interface QuotaErrorPayload {
  code: QuotaCode;
  message: string;
  upgradeUrl: string;
  // BudgetExceededError: full payload spread in (cap_type, usage_today_usd, upgrade, topup, ...).
  // FeatureQuotaExceededError: feature + tier are also present.
  [k: string]: unknown;
}

export function isQuotaError(err: unknown): err is BudgetExceededError | FeatureQuotaExceededError {
  return err instanceof BudgetExceededError || err instanceof FeatureQuotaExceededError;
}

/**
 * Build the canonical 402 JSON body for any quota/budget error.
 * Safe to call from any catch — does NOT throw.
 */
export async function buildQuotaErrorPayload(
  err: BudgetExceededError | FeatureQuotaExceededError,
): Promise<QuotaErrorPayload> {
  if (err instanceof BudgetExceededError) {
    const rich = await buildBudgetExceededPayload(err);
    const upgradeUrl = rich.upgrade?.checkout_url ?? `/pricing?source=cap_hit_${err.surface ?? 'general'}`;
    return {
      code: 'BUDGET_EXCEEDED',
      message: rich.message,
      upgradeUrl,
      ...rich,
    };
  }
  // FeatureQuotaExceededError
  const upgradeUrl = `/pricing?source=feature_quota_${err.feature}`;
  return {
    code: 'QUOTA_EXCEEDED',
    message: `You've reached your monthly ${err.feature} limit on the ${err.tier} plan. Upgrade to keep going.`,
    upgradeUrl,
    error: 'feature_quota_exceeded',
    feature: err.feature,
    tier: err.tier,
    limit: err.limit,
  };
}

/** 402 Response with the canonical body. Pass `req` so CORS echoes the origin. */
export async function quotaErrorResponse(
  err: BudgetExceededError | FeatureQuotaExceededError,
  req?: Request,
): Promise<Response> {
  const payload = await buildQuotaErrorPayload(err);
  const headers = req ? buildCorsHeaders(req) : corsHeaders;
  return new Response(JSON.stringify(payload), {
    status: 402,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

/**
 * Terminal SSE event for mid-stream quota/budget trips. Encode and
 * `controller.enqueue(...)` the result before closing the stream.
 */
export async function quotaErrorSseEvent(
  err: BudgetExceededError | FeatureQuotaExceededError,
): Promise<Uint8Array> {
  const payload = await buildQuotaErrorPayload(err);
  const chunk = `event: quota_exceeded\ndata: ${JSON.stringify(payload)}\n\n`;
  return new TextEncoder().encode(chunk);
}