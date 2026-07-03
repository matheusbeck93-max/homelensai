/**
 * Optional request/response body sampler for AI provider calls.
 *
 * Enabled per-deploy by setting `AI_ROUTER_DEBUG_LOG_REQUESTS=1`. When on,
 * providers push one row per gateway call into `public.ai_debug_requests`
 * (fire-and-forget). Used for short observation windows after a deploy;
 * turn OFF once you're done — the table can grow fast.
 *
 * Never write PII bodies you wouldn't be comfortable exporting: the raw
 * `request_body` is captured as-is.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getModelSpec, type ModelId } from "./modelRegistry.ts";
import type { SurfaceId } from "./surfaceConfig.ts";
import type { Tier, Usage } from "./types.ts";
import { getCurrentOrigin } from "./requestContext.ts";

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

export function isDebugRequestLogEnabled(): boolean {
  return Deno.env.get("AI_ROUTER_DEBUG_LOG_REQUESTS") === "1";
}

export interface DebugRequestEntry {
  surface?: SurfaceId | string;
  userId?: string;
  tier?: Tier;
  modelId: ModelId;
  requestBody: unknown;
  responseText?: string;
  usage?: Usage;
  status: "ok" | "error";
  latencyMs?: number;
  providerRequestId?: string;
  errorMessage?: string;
}

export function logDebugRequestAsync(entry: DebugRequestEntry): void {
  if (!isDebugRequestLogEnabled()) return;
  queueMicrotask(() => {
    writeRow(entry).catch((err) => {
      console.error("[ai-debug-log] write failed:", (err as Error)?.message);
    });
  });
}

async function writeRow(entry: DebugRequestEntry): Promise<void> {
  const client = getServiceClient();
  if (!client) return;
  const spec = getModelSpec(entry.modelId);
  const origin = getCurrentOrigin();
  await client.from("ai_debug_requests").insert({
    user_id: entry.userId ?? null,
    surface: entry.surface ?? "unknown",
    model_id: entry.modelId,
    api_name: spec.apiName,
    tier: entry.tier ?? null,
    request_body: entry.requestBody ?? null,
    response_text: entry.responseText ? entry.responseText.slice(0, 20000) : null,
    input_tokens: entry.usage?.inputTokens ?? null,
    output_tokens: entry.usage?.outputTokens ?? null,
    cache_read_input_tokens: entry.usage?.cacheReadInputTokens ?? null,
    cache_creation_input_tokens: entry.usage?.cacheCreationInputTokens ?? null,
    status: entry.status,
    latency_ms: entry.latencyMs ?? null,
    provider_request_id: entry.providerRequestId ?? null,
    error_message: entry.errorMessage ? entry.errorMessage.slice(0, 4000) : null,
    is_dev_call: Boolean(origin && /localhost|127\.0\.0\.1|lovable\.app|lovableproject\.com|lovable\.dev/i.test(origin)),
  });
}