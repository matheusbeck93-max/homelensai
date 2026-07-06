import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthed } from "../supabase";
import { currentTier } from "../tiers";
import { checkDailyLimit } from "../rateLimit";
import { internalCall, extractErr } from "../internalCall";
import { logMcpCall } from "../usageLog";

const TOOL = "market_trends";
const FREE_DAILY_LIMIT = 5;

export default defineTool({
  name: TOOL,
  title: "US market trends",
  description:
    "Get real estate market trends (median price, days-on-market, inventory) for a US metro or city. Free tier: 5 calls per day.",
  inputSchema: {
    location: z.string().max(200).describe("Metro or city name, e.g. 'Austin, TX' or 'Miami-Dade County'."),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async ({ location }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const started = Date.now();
    const tier = await currentTier(ctx);
    const limit = await checkDailyLimit(ctx, tier, TOOL, FREE_DAILY_LIMIT);
    if (limit.ok === false) {
      logMcpCall({ userId: ctx.getUserId(), toolName: TOOL, tierAtCall: tier, outcome: "rate_limited", latencyMs: Date.now() - started });
      return limit.blocked;
    }
    const res = await internalCall<Record<string, unknown>>("market-trends", { location }, ctx);
    if (!res.ok) {
      logMcpCall({ userId: ctx.getUserId(), toolName: TOOL, tierAtCall: tier, outcome: "error", latencyMs: Date.now() - started });
      return { content: [{ type: "text", text: `Market trends failed: ${extractErr(res.data)}` }], isError: true };
    }
    logMcpCall({ userId: ctx.getUserId(), toolName: TOOL, tierAtCall: tier, outcome: "ok", latencyMs: Date.now() - started });
    const d = res.data as { insights?: string };
    return {
      content: [
        { type: "text", text: d?.insights ?? `Market trends for ${location}.` },
        { type: "text", text: JSON.stringify(res.data, null, 2).slice(0, 8000) },
      ],
      structuredContent: res.data as Record<string, unknown>,
    };
  },
});