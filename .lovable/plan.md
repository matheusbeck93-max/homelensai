# Tier gating + discoverability for HomeLens MCP

## Goal

1. Make it impossible for a Free user connected via Claude/ChatGPT to reach Premium data.
2. Give users a clear place to discover the MCP URL and install instructions.
3. Log MCP tool usage so we can see adoption per tier.

## How gating actually works (why this is safe)

Every MCP tool handler executes inside our `supabase/functions/mcp` edge function. When Claude/ChatGPT calls a tool, we already have the user's Supabase JWT (mcp-js verifies it against Supabase's OIDC issuer). Inside the handler we:

1. Read the caller's row from `public.profiles` using a **service-role** client (bypasses RLS on `subscription_status`, which the user cannot write to — the existing `prevent_privileged_profile_updates` trigger already blocks that).
2. Compare `subscription_status` to the tool's required tier.
3. If Free and the tool is Premium, return an "Upgrade at homelensais.com/pricing" text block instead of data. The user still *sees* the tool exists in their assistant (good for conversion), but the tool never returns Premium data.

The client cannot bypass this because the check runs on our server, using the identity Supabase Auth issued. There is no client-side flag to flip.

## Tier map for the current 5 tools

| Tool                       | Tier     | Rationale                                                              |
| -------------------------- | -------- | ---------------------------------------------------------------------- |
| `echo`                     | Free     | Connectivity check.                                                    |
| `get_profile`              | Free     | User's own preferences — safe demo of value.                           |
| `list_saved_properties`    | Free     | Free users can already save properties in-app.                         |
| `list_saved_analyses`      | Premium  | Saved Analyses is already a Premium in-app feature — keep it consistent. |
| `list_owned_properties`    | Premium  | Investor portfolio is Premium in-app.                                  |

Any future *write* or *AI-powered* tools (e.g. `run_match_score`, `save_analysis`, `get_neighborhood_intel`) default to Premium unless explicitly opened up.

## Implementation

### 1. Tier helper for MCP tools

New file `src/lib/mcp/tiers.ts`:

- `type Tier = "free" | "premium"`
- `async function requireTier(ctx, minTier): Promise<{ ok: true } | { ok: false, upgrade: ToolResult }>`
  - Uses a Supabase **service-role** client (not the user-scoped one) to read `profiles.subscription_status` by `ctx.getUserId()`.
  - Treats `"active"`, `"trialing"`, `"canceling"` (any non-`null` non-`"free"` status) as Premium — matches existing `useSubscription` logic.
  - When gate fails, returns a ready-to-return tool result:
    > "This HomeLens tool requires Premium ($4.97/mo). Upgrade at https://homelensais.com/pricing to enable saved analyses, investor portfolio, and AI insights from your assistant."
- Cache the tier lookup for the duration of the request (single Map keyed by user id) so a batch of tool calls in one turn doesn't hammer the DB.

### 2. Wire gating into the two Premium tools

Edit `src/lib/mcp/tools/list_saved_analyses.ts` and `src/lib/mcp/tools/list_owned_properties.ts`:

```ts
const gate = await requireTier(ctx, "premium");
if (!gate.ok) return gate.upgrade;
// ...existing query
```

Free tools (`echo`, `get_profile`, `list_saved_properties`) stay as-is.

### 3. Log MCP tool usage

New migration adds `public.mcp_usage_log`:

- `id uuid pk`, `user_id uuid`, `tool_name text`, `tier_at_call text`, `outcome text` (`ok` | `gated` | `error`), `latency_ms int`, `created_at timestamptz default now()`
- RLS: users can `select` their own rows; only service_role writes.
- GRANTs for authenticated (select) + service_role (all).

Add a thin `logMcpCall(...)` helper (`src/lib/mcp/usageLog.ts`) that fires-and-forgets an insert with the service-role client. Call it from each tool handler after the response is prepared. Not user-blocking; failures are swallowed with `console.warn`.

### 4. Public marketing page `/integrations`

New `src/pages/Integrations.tsx` + route in `src/App.tsx`. Reuses existing marketing components (`PublicNav`, `Footer`, Card, Button, brand tokens — no new design system).

Sections:
- **Hero**: "Bring HomeLens into your AI assistant." Subhead explains the value in one line. Primary CTA: copy MCP URL. Secondary: link to pricing.
- **The MCP URL card**: shows `https://yckcdxtatwolzilboahx.supabase.co/functions/v1/mcp` with a copy-to-clipboard button.
- **Per-client install steps** (tabbed): Claude Desktop, ChatGPT (Custom Connectors), Cursor, Codex. 3 concise steps each — the URL, "sign in with Google," "approve on the HomeLens consent screen."
- **Tools & tiers table**: lists the 5 tools with a Free/Premium badge each, matching the tier map above. Sets expectations before install.
- **FAQ / safety**: "Only your data" (RLS explanation in plain English), "Revoke any time" (link to `/console`), "We never see your Claude/ChatGPT conversations."

Link the page from:
- Footer under "Product"
- Pricing page (small "Also works with Claude, ChatGPT, Cursor →" line under the Premium tier)
- `/console` (small integration card)

### 5. Add MCP mention to pricing

In `src/components/PricingSection.tsx`, add one bullet to each tier so the value is visible where users are already deciding:
- Free: "Connect to Claude/ChatGPT (basic tools)"
- Premium: "Connect to Claude/ChatGPT (all tools, including Saved Analyses + Portfolio)"

### 6. Update MCP `instructions` string

In `src/lib/mcp/index.ts`, add one line so the connecting assistant knows some tools may return an upgrade message:

> "Some tools require HomeLens Premium; when a tool returns an upgrade message, relay it verbatim and stop — do not retry."

Regenerate the manifest and redeploy the `mcp` function.

## Out of scope (deliberately)

- Hiding Premium tools from Free users' tool list. We chose the "friendly upgrade message" path — tools stay visible so Free users see what they'd unlock.
- Rate limiting per user (can add later if abuse shows up in `mcp_usage_log`).
- Write tools / AI-powered tools. When those land they'll follow the same `requireTier("premium")` pattern by default.

## Files touched

- **New**: `src/lib/mcp/tiers.ts`, `src/lib/mcp/usageLog.ts`, `src/pages/Integrations.tsx`, one migration for `mcp_usage_log`.
- **Edited**: `src/lib/mcp/index.ts` (instructions), `src/lib/mcp/tools/list_saved_analyses.ts`, `src/lib/mcp/tools/list_owned_properties.ts`, `src/App.tsx` (route), `src/components/Footer.tsx` (link), `src/components/PricingSection.tsx` (bullets).
- **Redeploy**: `supabase/functions/mcp` after MCP edits; run `extract_mcp_manifest`.

## Verification

1. Sign in as a Free test user in Claude → call `list_saved_analyses` → assert the upgrade message text is returned (not data).
2. Upgrade the same user to Premium in Stripe test mode → call the same tool → assert real rows return.
3. `SELECT tool_name, tier_at_call, outcome, count(*) FROM mcp_usage_log GROUP BY 1,2,3` after the two tests shows the expected `gated` vs `ok` rows.
4. Visit `/integrations` on desktop + mobile, copy the MCP URL, walk the Claude install steps end-to-end.
