import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthed } from "../supabase";
import { currentTier } from "../tiers";
import { checkDailyLimit } from "../rateLimit";
import { internalCall, extractErr } from "../internalCall";
import { logMcpCall } from "../usageLog";

const TOOL = "analyze_listing";
const FREE_DAILY_LIMIT = 3;

function parseScore(text: string): number | null {
  const m = text.match(/MATCH_SCORE:\s*(\d{1,2})\s*\/\s*10/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n >= 0 && n <= 10 ? n : null;
}

export default defineTool({
  name: TOOL,
  title: "Analyze a property listing",
  description:
    "Analyze a US real estate listing URL (Zillow, Redfin, Realtor.com, etc.) using HomeLens AI. Returns a MATCH_SCORE (0-10), verdict, and buyability summary tailored to the user's saved goals. Free tier: 3 calls per day.",
  inputSchema: {
    url: z.string().url().max(2000).describe("Public URL to the property listing (Zillow, Redfin, Realtor.com, etc.)."),
    question: z.string().max(500).optional().describe("Optional specific question to focus the analysis (e.g. 'is this a good rental?')."),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async ({ url, question }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const started = Date.now();
    const tier = await currentTier(ctx);

    const limit = await checkDailyLimit(ctx, tier, TOOL, FREE_DAILY_LIMIT);
    if (!limit.ok) {
      logMcpCall({ userId: ctx.getUserId(), toolName: TOOL, tierAtCall: tier, outcome: "rate_limited", latencyMs: Date.now() - started });
      return limit.blocked;
    }

    const userMsg =
      (question?.trim() ? `${question.trim()}\n\n` : "Analyze this property for me. ") +
      `Property URL: ${url}`;

    const res = await internalCall<{ generatedText?: string; response?: string }>(
      "ai-chat",
      {
        messages: [{ role: "user", content: userMsg }],
        conversationMode: false,
      },
      ctx,
    );

    if (!res.ok) {
      logMcpCall({ userId: ctx.getUserId(), toolName: TOOL, tierAtCall: tier, outcome: "error", latencyMs: Date.now() - started });
      return { content: [{ type: "text", text: `Analysis failed: ${extractErr(res.data)}` }], isError: true };
    }

    const text = (res.data as { generatedText?: string; response?: string })?.generatedText
      ?? (res.data as { response?: string })?.response
      ?? "";
    const score = parseScore(text);

    logMcpCall({ userId: ctx.getUserId(), toolName: TOOL, tierAtCall: tier, outcome: "ok", latencyMs: Date.now() - started });

    return {
      content: [
        { type: "text", text: text || "(No analysis text returned.)" },
        { type: "text", text: JSON.stringify({ url, match_score: score, has_score: score !== null }, null, 2) },
      ],
      structuredContent: { url, match_score: score, analysis: text },
    };
  },
});