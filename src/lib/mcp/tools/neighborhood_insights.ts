import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthed } from "../supabase";
import { requireTier } from "../tiers";
import { internalCall, extractErr } from "../internalCall";
import { logMcpCall } from "../usageLog";

const TOOL = "neighborhood_insights";

export default defineTool({
  name: TOOL,
  title: "Neighborhood insights",
  description:
    "Get schools, walkability, crime, and demographic insights for a US address or neighborhood using HomeLens (Perplexity-backed). Requires Buyer or Investor plan.",
  inputSchema: {
    address: z.string().max(200).optional().describe("Street address (optional if city/state provided)."),
    city: z.string().max(100).describe("City name."),
    state: z.string().max(2).describe("Two-letter state code (e.g. CA, NY)."),
    zip: z.string().max(10).optional().describe("ZIP code (optional)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async ({ address, city, state, zip }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const started = Date.now();
    const gate = await requireTier(ctx, { kind: "paid" });
    if (!gate.ok) {
      logMcpCall({ userId: ctx.getUserId(), toolName: TOOL, tierAtCall: gate.tier, outcome: "gated", latencyMs: Date.now() - started });
      return gate.upgrade!;
    }
    const res = await internalCall<Record<string, unknown>>(
      "neighborhood-insights",
      { address: address ?? "", city, state, zip: zip ?? "" },
      ctx,
    );
    if (!res.ok) {
      logMcpCall({ userId: ctx.getUserId(), toolName: TOOL, tierAtCall: gate.tier, outcome: "error", latencyMs: Date.now() - started });
      return { content: [{ type: "text", text: `Neighborhood insights failed: ${extractErr(res.data)}` }], isError: true };
    }
    logMcpCall({ userId: ctx.getUserId(), toolName: TOOL, tierAtCall: gate.tier, outcome: "ok", latencyMs: Date.now() - started });
    const d = res.data as { aiSummary?: string };
    return {
      content: [
        { type: "text", text: d?.aiSummary ?? `Neighborhood data for ${city}, ${state}.` },
        { type: "text", text: JSON.stringify(res.data, null, 2).slice(0, 8000) },
      ],
      structuredContent: res.data as Record<string, unknown>,
    };
  },
});