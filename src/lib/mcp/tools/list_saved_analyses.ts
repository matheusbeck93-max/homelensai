import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthed, errorResult } from "../supabase";
import { requireTier } from "../tiers";
import { logMcpCall } from "../usageLog";

export default defineTool({
  name: "list_saved_analyses",
  title: "List saved AI analyses",
  description: "Return the signed-in user's saved HomeLens AI property analyses (with match scores and summaries). Premium feature.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max rows to return (default 20)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const started = Date.now();
    const gate = await requireTier(ctx, { kind: "paid" });
    if (!gate.ok) {
      logMcpCall({
        userId: ctx.getUserId(),
        toolName: "list_saved_analyses",
        tierAtCall: gate.tier,
        outcome: "gated",
        latencyMs: Date.now() - started,
      });
      return gate.upgrade;
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("saved_analyses")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) {
      logMcpCall({
        userId: ctx.getUserId(),
        toolName: "list_saved_analyses",
        tierAtCall: gate.tier,
        outcome: "error",
        latencyMs: Date.now() - started,
      });
      return errorResult(error.message);
    }
    logMcpCall({
      userId: ctx.getUserId(),
      toolName: "list_saved_analyses",
      tierAtCall: gate.tier,
      outcome: "ok",
      latencyMs: Date.now() - started,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { count: data?.length ?? 0, analyses: data ?? [] },
    };
  },
});