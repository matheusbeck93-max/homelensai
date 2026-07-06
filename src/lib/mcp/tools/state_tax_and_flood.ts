import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthed } from "../supabase";
import { currentTier } from "../tiers";
import { internalCall, extractErr } from "../internalCall";
import { logMcpCall } from "../usageLog";

const TOOL = "state_tax_and_flood";

export default defineTool({
  name: TOOL,
  title: "State tax + flood risk",
  description:
    "Get state income tax, effective property tax rate, and flood-zone risk indicators for a US state (and address when provided).",
  inputSchema: {
    state: z.string().max(50).describe("US state name or two-letter code (e.g. 'California' or 'CA')."),
    address: z.string().max(300).optional().describe("Optional full address for flood-zone lookup."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ state, address }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const started = Date.now();
    const tier = await currentTier(ctx);
    const res = await internalCall<Record<string, unknown>>(
      "get-state-tax-data",
      { state, address: address ?? "" },
      ctx,
    );
    if (!res.ok) {
      logMcpCall({ userId: ctx.getUserId(), toolName: TOOL, tierAtCall: tier, outcome: "error", latencyMs: Date.now() - started });
      return { content: [{ type: "text", text: `Tax/flood lookup failed: ${extractErr(res.data)}` }], isError: true };
    }
    logMcpCall({ userId: ctx.getUserId(), toolName: TOOL, tierAtCall: tier, outcome: "ok", latencyMs: Date.now() - started });
    return {
      content: [
        { type: "text", text: `State tax and flood data for ${state}${address ? ` (${address})` : ""}.` },
        { type: "text", text: JSON.stringify(res.data, null, 2).slice(0, 6000) },
      ],
      structuredContent: res.data as Record<string, unknown>,
    };
  },
});