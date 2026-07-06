import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthed } from "../supabase";
import { requireTier } from "../tiers";
import { internalCall, extractErr } from "../internalCall";
import { logMcpCall } from "../usageLog";

const TOOL = "compare_properties";

export default defineTool({
  name: TOOL,
  title: "Compare properties",
  description:
    "Compare 2 to 4 US real estate listing URLs side-by-side with HomeLens AI ranking and reasoning. Requires Buyer or Investor plan.",
  inputSchema: {
    urls: z.array(z.string().url()).min(2).max(4).describe("2 to 4 public listing URLs (Zillow, Redfin, Realtor.com, etc.)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async ({ urls }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const started = Date.now();
    const gate = await requireTier(ctx, { kind: "paid" });
    if (!gate.ok) {
      logMcpCall({ userId: ctx.getUserId(), toolName: TOOL, tierAtCall: gate.tier, outcome: "gated", latencyMs: Date.now() - started });
      return gate.upgrade!;
    }

    // Fetch each property via fetch-property (Firecrawl). Best-effort; skip failures.
    const properties: Record<string, unknown>[] = [];
    for (const url of urls) {
      const r = await internalCall<{ property?: Record<string, unknown> }>("fetch-property", { url }, ctx);
      if (r.ok) {
        const p = (r.data as { property?: Record<string, unknown> })?.property ?? (r.data as Record<string, unknown>);
        properties.push({ ...p, sourceUrl: url });
      }
    }
    if (properties.length < 2) {
      logMcpCall({ userId: ctx.getUserId(), toolName: TOOL, tierAtCall: gate.tier, outcome: "error", latencyMs: Date.now() - started });
      return { content: [{ type: "text", text: "Could not fetch at least 2 properties. Check the URLs." }], isError: true };
    }

    const res = await internalCall<Record<string, unknown>>("compare-properties-ai", { properties }, ctx);
    if (!res.ok) {
      logMcpCall({ userId: ctx.getUserId(), toolName: TOOL, tierAtCall: gate.tier, outcome: "error", latencyMs: Date.now() - started });
      return { content: [{ type: "text", text: `Comparison failed: ${extractErr(res.data)}` }], isError: true };
    }
    logMcpCall({ userId: ctx.getUserId(), toolName: TOOL, tierAtCall: gate.tier, outcome: "ok", latencyMs: Date.now() - started });
    const d = res.data as { analysis?: string; recommendation?: string; response?: string };
    const summary = d?.analysis ?? d?.recommendation ?? d?.response ?? "Comparison complete.";
    return {
      content: [
        { type: "text", text: typeof summary === "string" ? summary : JSON.stringify(summary).slice(0, 4000) },
        { type: "text", text: JSON.stringify(res.data, null, 2).slice(0, 8000) },
      ],
      structuredContent: res.data as Record<string, unknown>,
    };
  },
});