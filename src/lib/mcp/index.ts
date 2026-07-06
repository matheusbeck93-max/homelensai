import { auth, defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import getProfileTool from "./tools/get_profile";
import listSavedPropertiesTool from "./tools/list_saved_properties";
import listSavedAnalysesTool from "./tools/list_saved_analyses";
import listOwnedPropertiesTool from "./tools/list_owned_properties";
import analyzeListingTool from "./tools/analyze_listing";
import neighborhoodInsightsTool from "./tools/neighborhood_insights";
import marketTrendsTool from "./tools/market_trends";
import stateTaxAndFloodTool from "./tools/state_tax_and_flood";
import mortgageCalculatorTool from "./tools/mortgage_calculator";
import rentalCalculatorTool from "./tools/rental_calculator";
import comparePropertiesTool from "./tools/compare_properties";
import saveAnalysisTool from "./tools/save_analysis";
import savePropertyTool from "./tools/save_property";

// OAuth issuer MUST be the direct supabase.co host (not lovable.cloud proxy).
// Built from the project ref that Vite inlines at build time; fallback keeps
// module evaluation safe during manifest extraction.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "homelens-mcp",
  title: "HomeLens AI",
  version: "0.2.0",
  instructions:
    "HomeLens AI tools for US real estate. Call `get_profile` first to load the user's goals, budget, and target cities before making recommendations. " +
    "Use `analyze_listing` (paste any Zillow/Redfin/Realtor URL) for a MATCH_SCORE and buyability verdict; `neighborhood_insights` for schools/crime/walkability; " +
    "`market_trends` for metro-level price and inventory data; `state_tax_and_flood` for tax rates and flood risk; " +
    "`mortgage_calculator` and `rental_calculator` for full PITI and cash-flow math; `compare_properties` to rank 2–4 listings side-by-side. " +
    "Use `list_saved_properties` / `list_saved_analyses` / `list_owned_properties` to read the user's HomeLens data, and `save_property` / `save_analysis` to write back. " +
    "Free-tier limits: analyze_listing 3/day, market_trends 5/day via MCP. Paid features (neighborhood_insights, rental_calculator, compare_properties, saved analyses, owned portfolio) require a Buyer or Investor plan. " +
    "When a tool returns an upgrade or rate-limit message, relay it VERBATIM to the user (including the pricing URL) and stop — do not retry, do not paraphrase, do not suggest alternatives.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    echoTool,
    getProfileTool,
    listSavedPropertiesTool,
    listSavedAnalysesTool,
    listOwnedPropertiesTool,
    analyzeListingTool,
    neighborhoodInsightsTool,
    marketTrendsTool,
    stateTaxAndFloodTool,
    mortgageCalculatorTool,
    rentalCalculatorTool,
    comparePropertiesTool,
    saveAnalysisTool,
    savePropertyTool,
  ],
});