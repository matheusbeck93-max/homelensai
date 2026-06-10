/**
 * Shared budget + usage-logging helpers for the `perplexity-chat` edge
 * function. Perplexity calls bypass the Lovable AI router, so this is the
 * single place that wires them into `checkBudget` (daily + monthly caps)
 * and writes spend rows to `ai_usage_log` so the Usage page, Overview
 * card, header chip, and `BudgetCapBlocker` all see Perplexity spend.
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  BudgetExceededError,
  buildBudgetExceededPayload,
  checkBudget,
} from "./budgetGuard.ts";
import { perplexityCostUsd } from "./modelRegistry.ts";
import type { SurfaceId } from "./surfaceConfig.ts";
import type { Tier } from "./types.ts";

let cachedClient: SupabaseClient | null = null;
function getServiceClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

/** Resolve the caller's user id + budget tier from the Authorization header. */
export async function resolvePerplexityCaller(
  req: Request,
): Promise<{ userId: string | null; tier: Tier }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return { userId: null, tier: "free" };

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return { userId: null, tier: "free" };

  try {
    const client = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData } = await client.auth.getUser();
    const user = userData?.user;
    if (!user) return { userId: null, tier: "free" };

    const { data: profile } = await client
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .maybeSingle();
    const status = (profile as { subscription_status?: string } | null)?.subscription_status;
    let tier: Tier = "free";
    if (status === "investor" || status === "premium") tier = "investor";
    else if (status === "buyer" || status === "paid") tier = "buyer";
    return { userId: user.id, tier };
  } catch (e) {
    console.warn("[perplexity-chat] resolve caller failed:", (e as Error)?.message);
    return { userId: null, tier: "free" };
  }
}

/**
 * Pre-call budget gate. Returns `null` when allowed, or a 402 `Response`
 * carrying the structured `budget_exceeded` payload that the frontend
 * `useBudgetCap` / `BudgetCapBlocker` already handle.
 */
export async function enforcePerplexityBudget(opts: {
  userId: string | null;
  tier: Tier;
  surface: SurfaceId;
  corsHeaders: Record<string, string>;
}): Promise<Response | null> {
  if (!opts.userId) return null; // Anonymous calls fall back to credits-only path.
  const svc = getServiceClient();
  try {
    const status = await checkBudget(opts.userId, opts.tier, { client: svc });
    if (status.allowed) return null;
    const err = new BudgetExceededError(
      opts.tier,
      status.usedUsd,
      status.capUsd,
      opts.surface,
      undefined,
      status.capType ?? "daily",
      status.monthlyUsedUsd ?? 0,
      status.monthlyCapUsd ?? 0,
    );
    const payload = await buildBudgetExceededPayload(err);
    return new Response(JSON.stringify(payload), {
      status: 402,
      headers: { ...opts.corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    // Fail-open: never strand a user on a telemetry failure.
    console.error("[perplexity-chat] budget check failed (allowing):", (e as Error)?.message);
    return null;
  }
}

/**
 * Fire-and-forget write to `ai_usage_log` for one Perplexity call.
 * Mirrors the shape `usageLogger.ts` writes for the router so the Usage
 * page and `budget-status` rollup pick it up automatically.
 */
export function logPerplexityUsageAsync(opts: {
  userId: string | null;
  tier: Tier;
  surface: SurfaceId;
  model: string;
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined | null;
  latencyMs?: number;
  status?: "ok" | "error";
  errorCode?: string;
  requestId?: string;
}): void {
  if (!opts.userId) return;
  const svc = getServiceClient();
  if (!svc) return;

  const promptTokens = Number(opts.usage?.prompt_tokens ?? 0) || 0;
  const completionTokens = Number(opts.usage?.completion_tokens ?? 0) || 0;
  const costUsd = perplexityCostUsd(opts.model, opts.usage);

  const row = {
    user_id: opts.userId,
    surface: opts.surface,
    model_id: `perplexity:${opts.model}`,
    api_name: opts.model,
    attempt: "primary" as const,
    tier: opts.tier,
    input_tokens: promptTokens,
    output_tokens: completionTokens,
    reasoning_tokens: 0,
    cost_usd: costUsd,
    latency_ms: opts.latencyMs ?? null,
    status: opts.status ?? "ok",
    error_code: opts.errorCode ?? null,
    request_id: opts.requestId ?? null,
  };

  queueMicrotask(() => {
    svc.from("ai_usage_log").insert(row).then(({ error }) => {
      if (error) {
        console.error("[perplexity-chat] usage log insert failed:", error.message);
      }
    });
  });
}