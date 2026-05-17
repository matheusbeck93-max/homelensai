# Phase 1 Cleanup — Finish remaining items

Scope is strictly the four pending Phase 1 items. No Phase 2 gates (G1/G2/G3), no behavior changes beyond replacing inline implementations with the shared utilities already created.

## 1. Migrate ai-chat Firecrawl loop to shared `scrapeProperty`

**File:** `supabase/functions/ai-chat/index.ts`, lines ~361–410 (FIRECRAWL branch).

Currently the function still inlines a raw `fetch('https://api.firecrawl.dev/v1/scrape', ...)` call and reads `FIRECRAWL_API_KEY` directly, even though `scrapeProperty` and `SCRAPE_FAILED_NOTE` are already imported at line 10.

Replace the inline loop with `scrapeProperty(url)` per detected URL:
- Drop the local `FIRECRAWL_API_KEY` env read and the early-return guard (the shared module handles missing key + fallback to `fetch-property`, returning `SCRAPE_FAILED_NOTE` on failure).
- Keep the `[ai-chat-branch]` log marker (branch: `firecrawl`) for the 7-day traffic study; just move it above the new loop.
- Preserve the downstream contract: build the same `html` / `markdown` strings used by the prompt builder so `firecrawlMatchScoreInstructions` and the rest of the prompt continue to work.
- On `SCRAPE_FAILED_NOTE`, surface the note in the assistant prompt context (do not throw) so the model can tell the user the page could not be read — matches the graceful-degradation contract the shared module advertises.

## 2. Wire `sanitizeHistory` into ai-chat

**File:** `supabase/functions/ai-chat/index.ts`, line 314 (and any other `messages.slice(...)` / raw `messages.map` that feed the Gateway).

`sanitizeHistory` is imported (line 8) but never called. Wrap the message array before it is spread into the Gateway payload:

```ts
const sanitized = sanitizeHistory(messages, { maxTurns: 30, enforceAlternation: true });
```

Then use `sanitized` everywhere the function currently passes `messages` or `messages.slice(0, -1)` to the model. Keep the last user turn appended explicitly as today.

## 3. `Chats.tsx` cosmetic renames

**File:** `src/pages/Chats.tsx`.

Scope is renames only — no behavior change, no routing change:
- Confirm the body key sent to `perplexity-chat` is `conversationHistory` (line 249 already is). Audit the rest of the file for any stale `history` / `chatHistory` field names sent to either backend and align them to `conversationHistory` so both edge functions see one canonical key.
- Align local variable names where they drifted (`sanitized`, `historyForApi`, etc.) so the dispatcher reads consistently. No new logic.

## 4. Documentation patches

**File:** `.lovable/plan.md` (the working doc — there is no `docs/` directory).

Apply the 10 doc patches from Phase 1 (P2 set):
1. Note that `dailyLimit.ts` is removed and AI credits are the sole rate-limiter.
2. Document the four new `_shared/` modules (`urlDetection`, `profileLoader`, `conversationHistory`, `scrapeProperty`) with one-line contracts each.
3. Update section 8 ("Personalization Logic") to spell out the cast-and-fallback behavior: `profile.buyer_type` values outside the three keys silently coerce to `regular-buyer` via the forgiving fallback at line 1369.
4. Add `KNOWN_PROFILES` / `KNOWN_GOALS` constants and the warning-log behavior for unknown values.
5. Replace the old "use emojis / 💰 section headers" claim with the new CRITICAL FORMATTING RULES (no emoji, no mandatory bullets, mirrors perplexity GENERAL contract).
6. Document the `[ai-chat-branch]` / `[perplexity-branch]` log markers and the 7-day traffic study purpose.
7. Update the URL-detection section to point at `_shared/urlDetection.ts` (single source of truth for the portal whitelist).
8. Update the Firecrawl section to point at `_shared/scrapeProperty.ts` with the Firecrawl → `fetch-property` fallback and `SCRAPE_FAILED_NOTE` contract.
9. Update the history-sanitization section to point at `_shared/conversationHistory.ts` (maxTurns + alternation enforcement).
10. Mark P0-4 Phase 2/3 (general-prompt deletion) as explicitly out of scope until the 7-day study produces data.

## Out of scope

- G1 match-score retry, G2 Excel full-context, G3 citations (all Phase 2 gates).
- P0-4 Phase 2/3 deletion of the ai-chat general prompt.
- Any UI changes to Chats.tsx beyond rename/alignment.

## Verification

- `grep -n "api.firecrawl.dev" supabase/functions/ai-chat/index.ts` returns nothing.
- `grep -n "sanitizeHistory(" supabase/functions/ai-chat/index.ts` returns at least one call site.
- `grep -rn "dailyLimit" supabase/functions src` returns nothing (regression check).
- Trigger a URL_ANALYSIS with a property URL: confirm `[ai-chat-branch] branch=firecrawl` log fires, scrape returns markdown, and `MATCH_SCORE: X/10` prefix is present in the response.
- Trigger an ai-chat call with a 40-message history: confirm sanitized payload is ≤ 30 turns and alternates user/assistant.
- Default chat path through perplexity-chat still works (no regression from renames).

---

## Phase 1 Cleanup — Completion Notes (Applied)

### Implementation status

1. **ai-chat Firecrawl loop → shared `scrapeProperty`.** The inline `fetch('https://api.firecrawl.dev/v1/scrape', ...)` loop and local `FIRECRAWL_API_KEY` env read in `supabase/functions/ai-chat/index.ts` were replaced with `scrapeProperty(url)`. On `scrape.markdown === null` the function returns a degraded property stub flagged `scrapeFailed: true` and uses `SCRAPE_FAILED_NOTE` as the description, so callers can still render a card and the AI can tell the user the page could not be read directly. The `[ai-chat-branch] branch=firecrawl` log marker stays for the 7-day traffic study.
2. **`sanitizeHistory` wired in ai-chat.** `sanitizeHistory(messages.slice(0, -1), { maxTurns: 30, enforceAlternation: true })` is invoked before the Gateway call at line ~304; the result replaces the raw `messages.slice(0, -1).map(...)` spread. The current user turn is still appended explicitly.
3. **Chats.tsx renames.** Already canonical — the body key is `conversationHistory` for both backends; no stale `history` / `chatHistory` fields found. No further changes required.

### Doc deltas (architecture contract)

1. **`dailyLimit.ts` removed.** AI credits (`deductAiCredits` + `creditCheck.tier`) are the sole rate-limiter for both `ai-chat` and `perplexity-chat`. Any UI copy referencing a "daily limit" should be reviewed by product.
2. **New `_shared/` modules.**
   - `urlDetection.ts` — single source of truth for the supported portal whitelist; exports `isPropertyUrl`, `extractFirstPropertyUrl`, and `isValidPortalSearchUrl`.
   - `profileLoader.ts` — per-request memoized profile fetch using `WeakMap<Request, Promise<profile>>`. One DB hit per request even across multiple call sites.
   - `conversationHistory.ts` — `sanitizeHistory({ maxTurns, enforceAlternation })`. `enforceAlternation: true` for Perplexity, optional for Gemini.
   - `scrapeProperty.ts` — Firecrawl markdown scrape with one bounded retry (25s timeout, 8k char cap). Returns `{ markdown: null, source: 'none', reason }` on failure. Pair with the exported `SCRAPE_FAILED_NOTE` constant for user-facing degradation copy.
3. **Personalization fallback (section 8).** `profile.buyer_type` values outside the three keys (`first-time-buyer`, `investor`, `regular-buyer`) silently coerce to `regular-buyer` via the forgiving fallback at ai-chat line 1369. The branch is live; the cast is intentional and acts as the default tone for unknown buyer types.
4. **Known-value guards.** `KNOWN_PROFILES` (ai-chat) and `KNOWN_GOALS` (perplexity-chat) emit a structured warning log when an unrecognized value is received, so drift between the DB enum and the prompt maps is observable without breaking runtime behavior.
5. **CRITICAL FORMATTING RULES.** The old "use emojis / 💰 section headers" mandate in the ai-chat general prompt is removed. Both backends now share the same contract: no mandatory emoji, no mandatory bullets, structure only when it improves scanability (≥3 supporting points), decision-first verdict in the first line. Mirrors the perplexity GENERAL prompt 1:1.
6. **Branch-marker logs.** `[ai-chat-branch]` and `[perplexity-branch]` structured logs identify which dispatch path served each request (`firecrawl`, `client-data`, `general`, `search`, `url-analysis`). Intended for a 7-day traffic study; do not remove without coordinating with the eng lead.
7. **URL detection.** Both backends now import `isPropertyUrl` / `extractFirstPropertyUrl` from `_shared/urlDetection.ts`. The portal whitelist (Zillow, Redfin, Realtor, Trulia, Homes, Compass, etc.) lives there only.
8. **Property scraping.** All property-URL scrapes route through `_shared/scrapeProperty.ts`. Direct calls to `https://api.firecrawl.dev/v1/scrape` in either backend are a regression; the only remaining direct Firecrawl callsite is the dedicated `fetch-property` edge function (unchanged).
9. **History sanitization.** All Gateway and Perplexity calls now wrap conversation history with `sanitizeHistory(...)`. `maxTurns: 30` for ai-chat (Gemini permissive), strict alternation enforced for perplexity-chat.
10. **P0-4 Phase 2/3 hold.** Deletion of the ai-chat general prompt is explicitly OUT OF SCOPE until the 7-day branch-marker study confirms zero non-listing traffic on ai-chat AND a Chrome extension audit confirms the listing-URL path does not depend on the general prompt's regional NLP.

### Verification (post-apply)

- `grep -n "api.firecrawl.dev" supabase/functions/ai-chat/index.ts` → 0 hits.
- `grep -n "sanitizeHistory(" supabase/functions/ai-chat/index.ts` → 1+ hits.
- `grep -rn "dailyLimit" supabase/functions src` → 0 hits.
- History payload to Gateway is now bounded to 30 turns and alternation-clean.
- Phase 2 gates (G1 match-score retry, G2 Excel full context, G3 citations) and Phase 3 deletion remain queued.
