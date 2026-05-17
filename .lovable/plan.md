# HomeLens AI Agent — Implementation Plan

Follows the prompt's "Lovable Review — Applied Updates" sequencing. Nothing in this plan weakens Decision-First, US-real-estate scope, MATCH_SCORE 0–100 storage, dual-route extension behavior, or the workflow_excel contract.

---

## Phase 1 — Apply now (safe, aligned with existing memory)

Low risk. No product decision needed. One surgical commit per item.

### 1. P0-1 — Style contradiction in ai-chat
- File: `supabase/functions/ai-chat/index.ts`
- Delete the two emoji/bullet-mandate lines at ~1423–1424.
- Replace with the perplexity GENERAL contract (no emojis, prose-first, no decorative headers, lead with verdict, forbidden openers).
- Audit 1160–1173 and replace ✅/❌ glyphs with plain text.
- Re-scan 996–1494 for any leftover "format with emojis / section headers / bold labels" lines and remove.
- Verify by diffing 3–5 sample outputs.

### 2. P0-2 — Remove dead dailyLimit
- Delete `supabase/functions/_shared/dailyLimit.ts`.
- Remove the import at `perplexity-chat/index.ts:8`.
- Grep `supabase/` for any other `dailyLimit` / `enforceDailyLimit` references and remove.
- Sweep UI copy for "3/day" remnants; replace with credits language.

### 3. P0-3 — Single source of truth for isPropertyUrl
- Create `supabase/functions/_shared/urlDetection.ts` exporting `isPropertyUrl` and `extractFirstPropertyUrl`.
- Domain whitelist = union of perplexity-chat + ai-chat current lists.
- Replace `isPropertyUrl` in perplexity-chat and `urlRegex` in ai-chat with imports.
- In `Chats.tsx`, replace `extractUrl` with `extractFirstPropertyUrl` (or rename to `extractAnyUrl` if any caller truly needs non-property URLs — verify with grep).

### 4. P0-4 Phase 1 only — Style sync ai-chat general prompt, do NOT delete
- Mirror perplexity GENERAL style rules into ai-chat 996–1494.
- Add `@deprecated` JSDoc comment on the general branch.
- Add the branch-marker `console.log` at the top of each prompt-assembly fork (general / extension / firecrawl / excel) for the 7-day traffic study. Phase 2/3 deletion is OUT of this plan.

### 5. P1-1 — Per-request profile loader
- Create `supabase/functions/_shared/profileLoader.ts` with `WeakMap<Request, Promise<profile>>` memoization.
- Replace all in-function profile fetches in perplexity-chat (73–114, 247–265) and ai-chat (779–897, 282–294, 691–709).
- Covers P1-6 by construction.

### 6. P1-2 — Shared conversation history sanitizer
- Create `supabase/functions/_shared/conversationHistory.ts` (`sanitizeHistory({ maxTurns, enforceAlternation })`).
- perplexity-chat: `maxTurns: 10, enforceAlternation: true`.
- ai-chat: `maxTurns: 20, enforceAlternation: false`.

### 7. P1-4 — Portal URL validator in SEARCH mode
- Add `validatePortalUrl` in perplexity-chat after the link extraction block.
- Drop links that fail shape check; drop the whole `links` array if all fail.

### 8. P1-5 — scrapeProperty fallback (Firecrawl → fetch-property)
- Create `supabase/functions/_shared/scrapeProperty.ts`.
- Replace Firecrawl calls in both backends with `scrapeProperty(url)`.
- On `source === 'none'`, append the explicit "couldn't fetch directly" note.
- Standardize 8000-char markdown cap across both backends.

### 9. P1-7 — buyer_type known-set check
- Add `KNOWN_PROFILES` constant + warning log in ai-chat at line 1369.
- Add parallel known-set check for `GOAL_CONTEXTS` keys in perplexity-chat.

### 10. P2 — Documentation patches (all 10 items)
- Update the architecture doc only. No code change.

---

## Phase 2 — Gated on explicit product sign-off

Three items with user-visible impact or cost changes. I will NOT touch these until you answer the gates below.

### G1. P0-5 — Match score retry
Recommended scope:
- Tolerant regex fallback in both `parseMatchScore` (Chats.tsx) and server-side extractor.
- Retry fires only when `profile.onboarding_completed === true`.
- Per-session `match-score-flaky` cache to avoid repeated retries (reset on session boundary or 5 consecutive successes).
- Before merge: round-trip test that Saved Analyses still stores 0–100 integer (memory contract).

**Gate:** confirm you accept the retry cost (one extra LLM call per missed extraction, gated to onboarded users only).

### G2. P0-6 — Excel call gets full context
- Pass full `messages` history + `userProfile` + `userGoal` + `intent: 'excel_generation'` to ai-chat on the Excel opt-in path.
- Add `intent === 'excel_generation'` branch in ai-chat with a focused workflow_excel prompt that reuses the shared profile/history loaders.
- Per-Excel credit cost will rise materially.

**Gate:** confirm acceptance of higher cost. Decide whether to add a "uses ~5 credits" hint in the Excel offer UI.

### G3. P0-7 — Citations rendering
Pick one. Default in plan = Option C (recommended middle ground).
- **A.** Keep suppression. Add a code comment documenting the intentional product decision. No other change.
- **B.** Inline `[N]` superscripts in `markdownComponents.tsx`.
- **C.** Collapsed `<details>` "Sources" footer at the bottom of grounded responses. No inline markers.

For B or C: remove the `[N]` suppression rule in the perplexity prompt AND update the ElevenLabs TTS sanitizer (`supabase/functions/elevenlabs-tts/index.ts` + any client-side sanitizer) to strip the new markers/footer before audio. Single atomic PR.

**Gate:** pick A / B / C.

---

## Phase 3 — Hold until data

### H1. P0-4 Phase 2 — 7-day traffic study
After Phase 1 ships, leave branch-marker logs running 7+ days. Query for `branch=general` counts.

### H2. P0-4 Phase 3 — Deletion (Option A)
ONLY if H1 logs show zero general traffic AND the Chrome extension audit confirms the listing-URL path doesn't depend on the general prompt's regional NLP. Then:
- Delete ai-chat general path (~996–1494) and post-processing (1583–1687) including the 5 regex sanitizers (1636–1660).
- Reduce ai-chat to `handleAttachments`, `handleExtension`, `handleExcelGeneration`.
- Port `searchParams` → `property_results_carousel` to perplexity-chat SEARCH mode using Perplexity `response_format: json_schema` (verify sonar supports it first; if not, keep ai-chat carousel path alive).

**Gate:** explicit go after data review.

---

## Phase 4 — Roadmap (out of this work stream)

### R1. P1-3 — Tool-calling migration
Defer. Track separately. Verify AI Gateway supports Gemini `tools` before scoping.

### R2. P1-8 — `ANSWER_FIRST_HEADER` doc fix
Doc-only; bundled with P2.

---

## Files touched in Phase 1

Edits:
- `src/pages/Chats.tsx`
- `supabase/functions/ai-chat/index.ts`
- `supabase/functions/perplexity-chat/index.ts`

New shared modules:
- `supabase/functions/_shared/urlDetection.ts`
- `supabase/functions/_shared/profileLoader.ts`
- `supabase/functions/_shared/conversationHistory.ts`
- `supabase/functions/_shared/scrapeProperty.ts`

Deletes:
- `supabase/functions/_shared/dailyLimit.ts`

Read-only references:
- `_shared/ai-gateway.ts`, `_shared/aiCredits.ts`, `fetch-property/index.ts`, `markdownComponents.tsx`, `UIBlockRenderer.tsx`.

---

## Commit sequence (Phase 1 only)

1. `fix(ai-chat): remove emoji/bullet style contradiction and ✅/❌ glyphs`
2. `chore(supabase): remove dead dailyLimit module and import`
3. `refactor(supabase): shared isPropertyUrl in _shared/urlDetection`
4. `refactor(ai-chat): style-sync general prompt to perplexity GENERAL; mark deprecated; add branch markers`
5. `perf(supabase): per-request profile loader memoization`
6. `refactor(supabase): shared conversation history sanitizer`
7. `feat(perplexity-chat): validate portal URLs before returning links`
8. `feat(supabase): scrapeProperty with Firecrawl + fetch-property fallback`
9. `fix(ai-chat): warn + fallback on unknown buyer_type / primary_goal`
10. `docs(architecture): P2 fixes (modes count, dailyLimit, isPropertyUrl, style citation, etc.)`

---

## Verification (Phase 1)

- Default chat: 10 representative queries through perplexity-chat; diff vs. baseline, only style should change in attachment/extension/Excel paths.
- Attachments path renders correctly with new style.
- Chrome extension end-to-end: general question (Perplexity) and listing URL (ai-chat) both work; style consistent.
- All 5 uiBlock types still render.
- `grep -r "dailyLimit\|enforceDailyLimit" supabase/` returns nothing.
- Same property URL (`zillow.com`, `realtor.ca`, `homes.com`, `compass.com`, generic `/property/`) routes identically through both backends.
- One profile fetch per request (temp log).
- 30-message history with duplicates + empties → sanitized payload per backend limits.
- Malformed portal URL injected → filtered before client.
- `FIRECRAWL_API_KEY` unset → fetch-property fallback fires, user gets coherent response with the "couldn't fetch directly" note.
- `userProfile: 'unknown'` → warning log, regular-buyer persona used.
- TTS still clean (no citation work done yet in Phase 1).

---

## What I need from you before I start

1. **Confirm Phase 1 scope** (10 items above) is what you want me to build now.
2. **Phase 2 gates** — answer when ready, not blocking Phase 1:
   - G1 (match score retry): yes / no.
   - G2 (Excel full context + cost): yes / no, and credit-cost UI hint yes / no.
   - G3 (citations): A / B / C.
3. **Phase 3 hold**: confirm you accept waiting 7 days post-Phase-1 before considering deletion.
