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
