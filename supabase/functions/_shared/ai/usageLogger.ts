/**
 * Fire-and-forget telemetry writer for the AI router.
 *
 * Writes one row to `public.ai_usage_log` per model call (primary or
 * fallback). Uses the service-role key so RLS doesn't block inserts.
 * Failures are swallowed and logged — telemetry must never break the
 * model response path.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getModelSpec } from "./modelRegistry.ts";
import type { SurfaceId } from "./surfaceConfig.ts";
import type { Tier, Usage } from "./types.ts";

export interface UsageLogEntry {
  userId: string;
  surface: SurfaceId;
  tier: Tier;
  usage: Usage;
  attempt: "primary" | "fallback";
  latencyMs?: number;
  status?: "ok" | "error";
  errorCode?: string;
  errorMessage?: string;
  requestId?: string;
  reasoningTokens?: number;
  isDevCall?: boolean;
}

let cachedClient: ReturnType<typeof createClient> | null = null;

function getServiceClient() {
  if (cachedClient) return cachedClient;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

export function logUsageAsync(entry: UsageLogEntry): void {
  // Fire-and-forget: do not await, do not throw.
  queueMicrotask(() => {
    writeUsageRow(entry).catch((err) => {
      console.error("[ai-router] usage log write failed:", (err as Error)?.message);
    });
  });
}

async function writeUsageRow(entry: UsageLogEntry): Promise<void> {
  const client = getServiceClient();
  if (!client) {
    if (Deno.env.get("AI_ROUTER_DEBUG") === "1") {
      console.log("[ai-router] no service client; skipping usage log");
    }
    return;
  }
  const spec = getModelSpec(entry.usage.modelId);
  const row = {
    user_id: entry.userId,
    surface: entry.surface,
    model_id: entry.usage.modelId,
    api_name: spec.apiName,
    attempt: entry.attempt,
    tier: entry.tier,
    input_tokens: entry.usage.inputTokens | 0,
    output_tokens: entry.usage.outputTokens | 0,
    reasoning_tokens: entry.reasoningTokens ?? 0,
    cache_read_input_tokens: entry.usage.cacheReadInputTokens ?? 0,
    cache_creation_input_tokens: entry.usage.cacheCreationInputTokens ?? 0,
    cost_usd: entry.usage.costUsd,
    latency_ms: entry.latencyMs ?? null,
    status: entry.status ?? "ok",
    error_code: entry.errorCode ?? null,
    error_message: entry.errorMessage ? entry.errorMessage.slice(0, 2000) : null,
    request_id: entry.requestId ?? null,
    is_dev_call: entry.isDevCall ?? false,
  };
  const { error } = await client.from("ai_usage_log").insert(row);
  if (error) throw error;
}