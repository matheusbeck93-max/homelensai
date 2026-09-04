# Plan: Connect Grok to HomeLens (use tools) + let Grok Build edit HomeLens

You asked for both, and weren't sure which Grok surface. Here's the reality, then the steps.

## The key distinction

- **Track A — Grok uses HomeLens's tools (MCP client):** Grok connects to HomeLens's already-deployed MCP server and can *call* its 14 tools (analyze a listing, read your profile, compare properties, save an analysis). Grok does **not** edit HomeLens code here. It's a user of HomeLens, not a builder.
- **Track B — Grok Build edits HomeLens code:** Grok Build (xAI's coding agent, `grok-build`) edits a code checkout. It cannot drive Lovable's preview, managed backend, or deploy. To let it touch HomeLens, you mirror the code to a public/private GitHub repo via Lovable Git Sync, then point Grok Build at that repo. This edits the **mirror**, outside Lovable — it loses Lovable's live preview, one-click deploy, and managed-backend tooling. Commits flow back into Lovable only if two-way sync is on.

These are two independent tracks. Track A is zero code (HomeLens's server is already done and deployed). Track B is workspace configuration on your side.

## Current state (verified)

- MCP server live: `src/lib/mcp/index.ts`, 14 tools, OAuth issuer `https://yckcdxtatwolzilboahx.supabase.co/auth/v1`.
- OAuth 2.1 authorization server: **enabled**, **dynamic client registration enabled**, consent page at `/.lovable/oauth/consent`. Debug found no OAuth issues.
- MCP function deployed; same Claude/ChatGPT/Cursor flow already works today.
- Git remote: only Lovable private storage — **no GitHub repo yet**.

## Track A — Grok uses HomeLens tools (recommended first, zero code)

xAI's docs confirm Grok supports remote MCP over Streamable HTTP and runs an OAuth browser flow automatically. HomeLens's server is OAuth 2.1 + DCR, so Grok self-registers and connects as a real HomeLens user (RLS runs as that user). No code change to HomeLens.

Steps you run on your machine (Grok CLI / Grok Build):

1. Install the Grok CLI if you don't have it (`grok`), then add the server:
   ```bash
   grok mcp add --transport http homelens https://yckcdxtatwolzilboahx.supabase.co/functions/v1/mcp
   ```
   Replace the host with your custom domain if you prefer: `https://homelensais.com/functions/v1/mcp`.
2. First call triggers the OAuth browser flow. Sign in to HomeLens, approve the connector on the `/.lovable/oauth/consent` page. Token is stored under `~/.grok`.
3. Verify: `grok mcp doctor homelens` (or `/mcps` in the TUI). Then ask Grok something like "Analyze https://www.zillow.com/... and tell me the match score." Grok should call `analyze_listing`.
4. Tool access follows your HomeLens plan: free tools (analyze 3/day, market_trends 5/day) work on Free; neighborhood/rental/compare/saved/owned require Buyer/Investor. Upgrade/limit messages come back verbatim.

Optional fallback (only if the OAuth flow fails for your surface) — a small code change I'd make:
- Add a **static API-key auth mode** alongside OAuth in `src/lib/mcp/index.ts` (a per-user token issued from the HomeLens console), so the **xAI API** path (programmatic Remote MCP Tools, which uses a static bearer token, not an OAuth flow) can call the server. This relaxes `requireOAuthClientClaim` for key-auth tokens only. Try OAuth first; I only build this if you confirm you need the programmatic xAI API path.

## Track B — Grok Build edits HomeLens code (mirror to GitHub)

No code change in HomeLens. This is workspace setup you do, then Grok Build runs against the repo.

1. Enable Git Sync from your Lovable workspace Git settings → connect a GitHub account → choose/create a repo (e.g. `homelens`). Lovable pushes the current source to it. Turn on **two-way sync** if you want Grok's commits to flow back into Lovable.
2. Clone that GitHub repo locally.
3. Install Grok Build, open the repo: `grok` (or `grok build`) in the checkout. Grok edits files, runs commands, commits.
4. Caveats — important:
   - Grok edits the **GitHub mirror**, not Lovable's live preview. You won't see changes in the Lovable preview until a two-way sync pulls the commit back (or you re-import).
   - Grok can't use Lovable's managed-backend tools (create tables, deploy functions, mint auth sessions) from the repo. Backend/schema changes still need to go through Lovable or raw SQL against your database.
   - Conflicts are possible if you also edit in Lovable between syncs. Prefer one editor at a time per branch.

## What I actually build

- **Track A (primary):** nothing in HomeLens — it's done and deployed. I give you the exact command + verify it after you run it.
- **Track A fallback (only if you need the xAI API path):** add the static API-key auth mode to the MCP server, a console page to issue/revoke keys, and redeploy the `mcp` function.
- **Track B:** nothing in HomeLens — it's your workspace Git Sync + Grok Build setup. I help wire anything backend-related Grok can't do from the repo.

## Recommended order

1. Run Track A's one command now — it should work today.
2. Decide if you need the programmatic xAI API path; if yes, I build the static-token mode.
3. Set up Track B only if you actually want Grok editing source (with the caveats above).
