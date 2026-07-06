import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthed } from "../supabase";
import { requireTier } from "../tiers";
import { internalCall, extractErr } from "../internalCall";
import { logMcpCall } from "../usageLog";

const TOOL = "save_analysis";

export default defineTool({
  name: TOOL,
  title: "Save an analysis to HomeLens",
  description:
    "Save a property analysis (typically produced by analyze_listing) to the user's HomeLens Saved Analyses dashboard. Requires Buyer or Investor plan.",
  inputSchema: {
    analysisSummary: z.string().min(1).max(50000).describe("The analysis text to save."),
    propertyUrl: z.string().url().max(2000).optional().describe("Listing URL, if known."),
    propertyAddress: z.string().max(500).optional().describe("Full address, if known."),
    propertyPrice: z.number().nonnegative().optional().describe("List price in USD, if known."),
    matchScore: z.number().int().min(0).max(10).optional().describe("MATCH_SCORE (0-10) from analyze_listing, if known."),
  },
  annotations: { readOnlyHint: false, openWorldHint: false, idempotentHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const started = Date.now();
    const gate = await requireTier(ctx, { kind: "paid" });
    if (!gate.ok) {
      logMcpCall({ userId: ctx.getUserId(), toolName: TOOL, tierAtCall: gate.tier, outcome: "gated", latencyMs: Date.now() - started });
      return gate.upgrade!;
    }
    const body: Record<string, unknown> = {
      analysisSummary: input.analysisSummary,
      propertyUrl: input.propertyUrl ?? null,
      propertyAddress: input.propertyAddress ?? null,
      propertyPrice: input.propertyPrice ?? null,
      investmentScore: input.matchScore != null ? input.matchScore * 10 : null,
      source: "app",
    };
    const res = await internalCall<Record<string, unknown>>("save-analysis", body, ctx);
    if (!res.ok) {
      logMcpCall({ userId: ctx.getUserId(), toolName: TOOL, tierAtCall: gate.tier, outcome: "error", latencyMs: Date.now() - started });
      return { content: [{ type: "text", text: `Save failed: ${extractErr(res.data)}` }], isError: true };
    }
    logMcpCall({ userId: ctx.getUserId(), toolName: TOOL, tierAtCall: gate.tier, outcome: "ok", latencyMs: Date.now() - started });
    return {
      content: [
        { type: "text", text: "Analysis saved to your HomeLens dashboard. View it at https://homelensais.com/console." },
      ],
      structuredContent: res.data as Record<string, unknown>,
    };
  },
});