import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { Tier } from "./tiers";

declare const process: { env: Record<string, string | undefined> };

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
};

function serviceClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Per-day per-user usage cap for MCP tools, enforced by counting successful
 * rows in `mcp_usage_log`. Paid tiers bypass the cap (their AI credits are
 * already governed by the router/budget system).
 *
 * Returns { ok: false, blocked } with a ready-to-return upgrade message when
 * the user has hit the daily limit.
 */
export async function checkDailyLimit(
  ctx: ToolContext,
  tier: Tier,
  toolName: string,
  dailyLimit: number,
): Promise<{ ok: true } | { ok: false; blocked: ToolResult }> {
  if (tier === "buyer" || tier === "investor") return { ok: true };
  const userId = ctx.getUserId();
  if (!userId) return { ok: true };
  try {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { count } = await serviceClient()
      .from("mcp_usage_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("tool_name", toolName)
      .eq("outcome", "ok")
      .gte("created_at", since.toISOString());
    if ((count ?? 0) < dailyLimit) return { ok: true };
  } catch {
    return { ok: true }; // fail-open on log query error
  }
  return {
    ok: false,
    blocked: {
      content: [
        {
          type: "text",
          text:
            `You have hit the free daily limit of ${dailyLimit} \`${toolName}\` calls through HomeLens MCP. ` +
            `Upgrade to Buyer or Investor at https://homelensais.com/pricing for higher limits, saved analyses, ` +
            `neighborhood insights, and rental calculators from your assistant.`,
        },
      ],
      structuredContent: { rate_limited: true, daily_limit: dailyLimit, tool: toolName },
    },
  };
}