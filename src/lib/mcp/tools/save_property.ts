import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthed, supabaseForUser } from "../supabase";
import { currentTier } from "../tiers";
import { logMcpCall } from "../usageLog";

const TOOL = "save_property";

export default defineTool({
  name: TOOL,
  title: "Save a property to HomeLens",
  description:
    "Save a US property listing URL to the user's HomeLens saved-properties list. Available to all HomeLens users.",
  inputSchema: {
    url: z.string().url().max(2000).describe("Listing URL (Zillow, Redfin, Realtor.com, etc.)."),
    address: z.string().max(500).describe("Full property address."),
    city: z.string().max(120).optional(),
    state: z.string().max(2).optional().describe("Two-letter state code."),
    price: z.number().nonnegative().optional(),
    beds: z.number().int().nonnegative().optional(),
    baths: z.number().nonnegative().optional(),
    sqft: z.number().int().nonnegative().optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: false, idempotentHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const started = Date.now();
    const tier = await currentTier(ctx);
    const userId = ctx.getUserId();
    const { data, error } = await supabaseForUser(ctx)
      .from("saved_properties")
      .insert({
        user_id: userId,
        property_url: input.url,
        property_address: input.address,
        city: input.city ?? null,
        state: input.state ?? null,
        price: input.price ?? null,
        beds: input.beds ?? null,
        baths: input.baths ?? null,
        sqft: input.sqft ?? null,
        source: "mcp",
      })
      .select()
      .maybeSingle();
    if (error) {
      logMcpCall({ userId, toolName: TOOL, tierAtCall: tier, outcome: "error", latencyMs: Date.now() - started });
      return { content: [{ type: "text", text: `Save failed: ${error.message}` }], isError: true };
    }
    logMcpCall({ userId, toolName: TOOL, tierAtCall: tier, outcome: "ok", latencyMs: Date.now() - started });
    return {
      content: [
        { type: "text", text: "Property saved to your HomeLens dashboard." },
        { type: "text", text: JSON.stringify(data ?? {}, null, 2) },
      ],
      structuredContent: (data ?? {}) as Record<string, unknown>,
    };
  },
});