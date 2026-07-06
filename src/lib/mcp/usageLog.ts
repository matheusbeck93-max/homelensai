import { createClient } from "@supabase/supabase-js";

declare const process: { env: Record<string, string | undefined> };

type Outcome = "ok" | "gated" | "error" | "rate_limited";

/**
 * Fire-and-forget log of an MCP tool invocation. Uses the service-role client
 * so writes bypass RLS. Failures are swallowed — logging must never break a
 * tool call.
 */
export function logMcpCall(params: {
  userId: string | null;
  toolName: string;
  tierAtCall: string;
  outcome: Outcome;
  latencyMs: number;
}): void {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // No await — background insert.
    void client
      .from("mcp_usage_log")
      .insert({
        user_id: params.userId,
        tool_name: params.toolName,
        tier_at_call: params.tierAtCall,
        outcome: params.outcome,
        latency_ms: params.latencyMs,
      })
      .then(({ error }) => {
        if (error) console.warn("[mcp] usage log insert failed:", error.message);
      });
  } catch (err) {
    console.warn("[mcp] usage log threw:", err);
  }
}