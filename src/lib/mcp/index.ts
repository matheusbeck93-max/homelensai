import { auth, defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import getProfileTool from "./tools/get_profile";
import listSavedPropertiesTool from "./tools/list_saved_properties";
import listSavedAnalysesTool from "./tools/list_saved_analyses";
import listOwnedPropertiesTool from "./tools/list_owned_properties";

// OAuth issuer MUST be the direct supabase.co host (not lovable.cloud proxy).
// Built from the project ref that Vite inlines at build time; fallback keeps
// module evaluation safe during manifest extraction.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "homelens-mcp",
  title: "HomeLens AI",
  version: "0.1.0",
  instructions:
    "HomeLens AI tools for US real estate. Use `get_profile` to load the user's goals, budget, and target cities before making recommendations. Use `list_saved_properties` / `list_saved_analyses` / `list_owned_properties` to read the user's HomeLens data. `echo` verifies connectivity.",
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
  ],
});