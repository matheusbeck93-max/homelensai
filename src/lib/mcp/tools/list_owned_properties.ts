import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthed, errorResult } from "../supabase";
import { requireTier } from "../tiers";
import { logMcpCall } from "../usageLog";

export default defineTool({
  name: "list_owned_properties",
  title: "List investor-owned properties",
  description: "Return the signed-in user's investor portfolio (owned properties tracked in HomeLens) with address, purchase details, current value estimate, and rental status.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max rows to return (default 50)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const started = Date.now();
    const gate = await requireTier(ctx, { kind: "investor" });
    if (!gate.ok) {
      logMcpCall({
        userId: ctx.getUserId(),
        toolName: "list_owned_properties",
        tierAtCall: gate.tier,
        outcome: "gated",
        latencyMs: Date.now() - started,
      });
      return gate.upgrade;
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("investor_owned_properties")
      .select("id,address_line1,city,state,zip,property_type,beds,baths,sqft,year_built,purchase_date,purchase_price,current_value_estimate,current_value_source,is_rented,is_primary_residence,has_mortgage,loan_current_balance,status,created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (error) {
      logMcpCall({
        userId: ctx.getUserId(),
        toolName: "list_owned_properties",
        tierAtCall: gate.tier,
        outcome: "error",
        latencyMs: Date.now() - started,
      });
      return errorResult(error.message);
    }
    logMcpCall({
      userId: ctx.getUserId(),
      toolName: "list_owned_properties",
      tierAtCall: gate.tier,
      outcome: "ok",
      latencyMs: Date.now() - started,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { count: data?.length ?? 0, properties: data ?? [] },
    };
  },
});