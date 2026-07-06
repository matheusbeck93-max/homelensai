
# HomeLens MCP — Full Analyst Pack

Turn the MCP connector from a read-only memory layer into a real analyst. Every new tool wraps an existing edge function on the server, runs under the user's Supabase JWT (RLS), enforces tier via `requireTier()`, and logs to `mcp_usage_log`.

## New tools

| Tool | Wraps | Tier | Purpose |
|---|---|---|---|
| `analyze_listing` | `ai-chat` (+`fetch-property` fallback) | Free (rate-limited) / Premium | Paste a Zillow/Redfin/Realtor URL → returns MATCH_SCORE, verdict, key facts, buyability summary. Killer demo. |
| `neighborhood_insights` | `neighborhood-insights` | Buyer/Investor | Schools, crime, trends, walkability for a city/ZIP via Perplexity. |
| `market_trends` | `market-trends` + FRED snapshot | Free | Median price, DOM, inventory, current 30-yr rate for a metro. |
| `state_tax_and_flood` | `get-state-tax-data` | Free | State income/property tax + flood-zone risk by address/state. |
| `mortgage_calculator` | `calculator-insights` (mortgage mode) | Free | P&I, PMI, taxes, insurance, total monthly, amortization summary. |
| `rental_calculator` | `calculator-insights` (rental mode) | Investor | Cash flow, cap rate, cash-on-cash, DSCR, break-even. |
| `compare_properties` | `compare-properties-ai` | Buyer/Investor | 2–4 URLs → side-by-side with HomeLens ranking + reasoning. |
| `save_analysis` | `save-analysis` | Buyer/Investor | Persist an analysis from the conversation → appears in `/console`. |
| `save_property` | direct insert into `saved_properties` | Free | Save a listing URL to the user's dashboard. |

Existing read tools (`echo`, `get_profile`, `list_saved_properties`, `list_saved_analyses`, `list_owned_properties`) stay unchanged.

## Free-tier abuse protection

`analyze_listing` and calculators cost AI credits. Add a per-user daily cap enforced in the MCP tool wrapper (not just the underlying function), reusing the existing `daily_analysis_count` on `profiles`:

- Free: 3 `analyze_listing` calls/day via MCP, then friendly upgrade message.
- Premium: uses existing plan credit budget (already enforced by the AI router).
- All calls logged to `mcp_usage_log` with `outcome ∈ {ok, gated, rate_limited, error}` and `latency_ms`.

## Tool response contract

Every tool returns MCP `content` blocks in this shape so Claude/ChatGPT render nicely:
1. One short `text` summary (human sentence, no markdown headers) — this is what the LLM will paraphrase.
2. One `text` block with a compact JSON payload (facts the model can quote precisely — score, price, monthly payment, etc.).
3. For gated/rate-limited: a single `text` block with the friendly upgrade line + `https://homelensais.com/pricing` (instructions in `defineMcp` already tell assistants to relay verbatim).

Never return raw HTML, images, or long markdown — assistants truncate it.

## Files to change

**New:**
- `src/lib/mcp/tools/analyze_listing.ts`
- `src/lib/mcp/tools/neighborhood_insights.ts`
- `src/lib/mcp/tools/market_trends.ts`
- `src/lib/mcp/tools/state_tax_and_flood.ts`
- `src/lib/mcp/tools/mortgage_calculator.ts`
- `src/lib/mcp/tools/rental_calculator.ts`
- `src/lib/mcp/tools/compare_properties.ts`
- `src/lib/mcp/tools/save_analysis.ts`
- `src/lib/mcp/tools/save_property.ts`
- `src/lib/mcp/rateLimit.ts` — free-tier daily cap helper (reads/increments `profiles.daily_analysis_count` via service role, resets on date rollover).
- `src/lib/mcp/internalCall.ts` — shared helper: calls an internal edge function with the user's JWT so RLS + existing auth guards still apply. Avoids duplicating business logic.

**Edited:**
- `src/lib/mcp/index.ts` — register 9 new tools, update `instructions` (mention analysis, calculators, comparisons; reinforce verbatim upgrade line + daily cap message).
- `src/lib/mcp/tiers.ts` — add `"buyer_or_investor"` helper if not already there.
- `src/pages/Integrations.tsx` — update tools/tiers table with the 9 new tools; add example prompts ("Paste a Zillow URL and ask 'is this a good buy?'", "Compare these 3 listings", "What's the true monthly cost at 6.5%?").
- `.lovable/mcp/manifest.json` — regenerated via `app_mcp_server--extract_mcp_manifest`.

**Redeploy:** `mcp` edge function.

## Technical notes

- **Internal call pattern:** Each new MCP tool calls its wrapped edge function via `internalCall(functionName, body, ctx)` which POSTs to `${SUPABASE_URL}/functions/v1/${functionName}` with `Authorization: Bearer ${ctx.getToken()}` and the publishable key. This preserves RLS + existing per-function tier/rate logic without re-implementing it.
- **No new AI credits path:** All AI cost still routes through the existing `ai-chat`/`calculator-insights`/`neighborhood-insights` functions, which already log to `ai_usage_log` and enforce the budget system. MCP layer only adds an extra per-user daily cap for `analyze_listing` (the highest-leverage abuse vector).
- **MATCH_SCORE contract preserved:** `analyze_listing` parses the `MATCH_SCORE: X/10` prefix from the ai-chat response (existing memory rule) and returns it as a structured field in the JSON block so assistants can quote the number reliably.
- **Zero client changes** beyond the Integrations page copy update.

## Verification

1. In Claude with a **Free** account: paste a Zillow URL → `analyze_listing` returns score + summary. Call 4× in a row → 4th returns rate-limit upgrade message. Call `rental_calculator` → returns Premium upgrade message.
2. Upgrade to **Investor**: `rental_calculator` returns real numbers; `compare_properties` with 3 URLs returns ranking.
3. Call `save_analysis` after `analyze_listing` → row appears in `/console` Saved Analyses.
4. SQL: `SELECT tool_name, tier_at_call, outcome, count(*) FROM mcp_usage_log WHERE created_at > now() - interval '1 day' GROUP BY 1,2,3` shows expected `ok` / `gated` / `rate_limited` mix.
5. `/integrations` page shows updated tool list and example prompts render correctly on mobile + desktop.

## Out of scope (follow-ups)

- Hiding gated tools entirely from Free users' catalog (right now they appear and return upgrade text — better for discovery/upsell).
- Write tools that modify owned properties (`add_owned_property`, `log_improvement`) — wait to see analyst-pack usage first.
- Voice/TTS output through MCP (ElevenLabs).
- MCP-specific SEO landing pages per client (Claude, ChatGPT, Cursor).
