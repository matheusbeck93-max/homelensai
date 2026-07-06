import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, notAuthed, errorResult } from "../supabase";

export default defineTool({
  name: "get_profile",
  title: "Get my HomeLens profile",
  description: "Return the signed-in user's HomeLens profile: goals, budget, target cities, buyer/investor persona, and preferences.",
  inputSchema: {},
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthed();
    const { data, error } = await supabaseForUser(ctx)
      .from("profiles")
      .select("full_name,user_profile,primary_goal,buyer_type,buyer_types,investment_strategy,investment_strategies,risk_level,budget_min,budget_max,max_price_range,desired_monthly_payment,min_bedrooms,min_bathrooms,min_sqft,max_sqft,preferred_cities,location_preferences,property_types,must_have_features,climate_preference,safety_priority,about_me,persona,persona_secondary,subscription_status")
      .eq("id", ctx.getUserId())
      .maybeSingle();
    if (error) return errorResult(error.message);
    if (!data) return errorResult("Profile not found.");
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { profile: data },
    };
  },
});