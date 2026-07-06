import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

declare const process: { env: Record<string, string | undefined> };

export type Tier = "free" | "buyer" | "investor";

/** Requirement expressed the same way as FEATURE_GATES in subscriptionPlans.ts. */
export type TierRequirement =
  | { kind: "paid" } // buyer OR investor
  | { kind: "investor" }; // investor only

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
  structuredContent?: unknown;
};

// Per-request memoization so a batch of tool calls in one turn only hits the DB once.
const tierCache = new Map<string, Promise<Tier>>();

function serviceRoleClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loadTier(userId: string): Promise<Tier> {
  const existing = tierCache.get(userId);
  if (existing) return existing;
  const p = (async () => {
    try {
      const { data } = await serviceRoleClient()
        .from("profiles")
        .select("subscription_status")
        .eq("id", userId)
        .maybeSingle();
      const raw = data?.subscription_status;
      if (raw === "buyer" || raw === "investor") return raw;
      // Backward-compat with legacy values, matches useSubscription.tsx.
      if (raw === "premium") return "investor";
      if (raw === "paid") return "buyer";
      return "free" as const;
    } catch {
      return "free" as const;
    }
  })();
  tierCache.set(userId, p);
  // Evict after 30s so long-lived instances stay fresh.
  setTimeout(() => tierCache.delete(userId), 30_000);
  return p;
}

function meetsRequirement(tier: Tier, req: TierRequirement): boolean {
  if (req.kind === "paid") return tier === "buyer" || tier === "investor";
  if (req.kind === "investor") return tier === "investor";
  return false;
}

function requirementLabel(req: TierRequirement): string {
  return req.kind === "investor" ? "Investor" : "Buyer or Investor";
}

/**
 * Server-side tier check for MCP tools. Runs inside the mcp edge function;
 * the MCP client (Claude/ChatGPT) cannot bypass it.
 *
 * Returns { ok: true, tier } on success, or { ok: false, tier, upgrade }
 * with a ready-to-return upgrade message when the caller's tier is too low.
 */
export async function requireTier(
  ctx: ToolContext,
  req: TierRequirement,
): Promise<
  | { ok: true; tier: Tier }
  | { ok: false; tier: Tier; upgrade: ToolResult }
> {
  const userId = ctx.getUserId();
  const tier = userId ? await loadTier(userId) : ("free" as Tier);
  if (meetsRequirement(tier, req)) return { ok: true, tier };
  const need = requirementLabel(req);
  return {
    ok: false,
    tier,
    upgrade: {
      content: [
        {
          type: "text",
          text:
            `This HomeLens tool requires a ${need} plan. ` +
            `You are currently on ${tier[0].toUpperCase() + tier.slice(1)}. ` +
            `Upgrade at https://homelensais.com/pricing to unlock saved analyses, investor portfolio, and other paid features from your assistant.`,
        },
      ],
      isError: false,
      structuredContent: { upgrade_required: true, current_tier: tier, required: need },
    },
  };
}

export async function currentTier(ctx: ToolContext): Promise<Tier> {
  const userId = ctx.getUserId();
  return userId ? loadTier(userId) : ("free" as Tier);
}