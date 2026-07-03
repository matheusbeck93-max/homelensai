
Root-cause diagnosis for all 4 issues, based on code reading + direct DB queries. No files changed yet.

## Issue 1 — Flash Lite migration cannot be verified (0 calls)

**Root cause: two bugs, both real.**

**(a) `MODEL_BY_OPERATION` is dead code.** `supabase/functions/_shared/ai/modelRegistry.ts:93–98` defines the map, but `rg MODEL_BY_OPERATION supabase/functions` returns exactly one hit — the definition. Nothing imports it. Routing is driven entirely by `SURFACE_CONFIG` in `_shared/ai/surfaceConfig.ts` via `pickModel()` in `router.ts:88`. The good news: `SURFACE_CONFIG` already points the four ops at `LITE` (`surfaceConfig.ts:152–187`), so the *config* is correct — the map just misleads readers into thinking that's where the wiring lives.

**(b) Three of the four ops have zero real callers.** Grep for the surface-id strings across the whole codebase (`rg "'photo_categorization'|'followup_ranking'|'intent_detection'|'memory_categorization'" supabase/functions`) returns:
- `memory_categorization` → 1 caller: `_shared/memory/extractor.ts:71` (real)
- `photo_categorization` → 0 callers (only appears in a `feature = "photos"` branch in `router.ts:203,274`)
- `followup_ranking` → 0 callers
- `intent_detection` → 0 callers

So the reason production shows zero Flash Lite rows is (a) `MODEL_BY_OPERATION` was never referenced by the router, and (b) three of the four features aren't wired to the router at all — the photo, followup, and intent flows currently either hit a different code path or don't fire an LLM call. `memory_categorization` is the only op that *should* be firing Flash Lite today.

**Fix scope:** delete `MODEL_BY_OPERATION` (or wire it in and drop it from `surfaceConfig` — pick one source of truth). Then audit the three unwired ops: find the code that classifies photos / ranks followups / detects intent (candidate files: `_shared/memory/*`, `chrome-extension` uploaders, ai-chat entrypoint, `lib/conversationalIntelligence/rankFollowups.ts`), decide whether they should route through the AI router at all, and either wire them to `completeWithFallback(<surface>, …)` or remove the unused surfaces from `SURFACE_CONFIG` so the "which ops exist" story stops lying.

**Verification:** after wiring, trigger each op end-to-end (upload a photo, open ai-chat, save a memory) and confirm one row per op lands in `ai_usage_log` with `api_name = 'google/gemini-3.1-flash-lite'`. No synthetic router bypass — use the real UI paths.

**ETA:** map cleanup 30 min; wiring/audit of the three ops 3–4 h (depends on whether the features already exist and just skipped the router, or need to be built).

## Issue 2 — Prompt caching produces 0 hits on most surfaces

**Root cause: cache is on, but the cached block often can't qualify.**

`_shared/ai/anthropicProvider.ts:103–111` always attaches `cache_control: { type: "ephemeral" }` to the `system` block, and `:113–119` also attaches it to every `tool`. That's correct wiring.

The production data explains the "0 hits" pattern once you break it down by surface (30-day, status=ok, Sonnet only):

| surface | rows | cache-hit rows | avg input tokens |
|---|---|---|---|
| general_chat | 36 | **5** | 10,255 |
| extension_listing_analysis | 28 | 0 | 2,398 |
| investor_brief | 8 | 0 | **860** |
| investor_chat | 6 | 0 | 8,706 |
| preferences_assistant | 2 | 0 | 2,846 |

Three distinct failure modes:

1. **Below the 1024-token minimum.** `investor_brief` averages 860 input tokens — the *entire* request is under the Sonnet ephemeral-cache floor, so `cache_control` on `system` is silently dropped. `extension_listing_analysis` at 2,398 avg is close enough that the `system` slice alone may be under 1024.
2. **Per-call templating inside `system`.** `investor_chat` sends 8.7 K input tokens per call but never hits cache. Very likely the system prompt embeds per-request data (active card context, session filters, user memory) *before* the cache marker's block, so no two calls share a byte-identical prefix. `anthropicProvider.buildBody` only ever emits *one* `system` block that concatenates every system message with `\n\n`, so any dynamic string mixed into `req.system` invalidates the whole cache.
3. **General_chat works partially (5 / 36).** Confirms the plumbing itself is fine; the misses on the other 31 are the same templating issue.

**Fix scope:**
- Split `system` into a `[static_prefix, dynamic_suffix]` pair in `anthropicProvider.buildBody`: only the first block carries `cache_control`, the second doesn't. Route callers to pass their invariant prompt through `req.system` and everything per-user/per-request through a first `user` turn (or a new `req.systemDynamic` field).
- Audit each caller (`ai-chat/index.ts:404,899,1904,1978`, `investor-chat/index.ts:1392`, `investor-brief/index.ts:309`, `preferences-assistant/index.ts:664`, `owned-property-chat/index.ts:290`) to move dynamic strings out of `system`.
- For `investor_brief` specifically, either accept it's un-cacheable (input < 1024 tokens) or pad the system block with additional static instructions to cross the threshold.

**Verification (as requested — no synthetic 5-call test):**
- Add an `AI_ROUTER_DEBUG_LOG_REQUESTS=1` env flag that, when set, writes the outgoing Anthropic body to a temp `ai_debug_requests` table (surface, timestamp, first 4 KB of `system`, block sizes, cache_control positions). Turn it on for ~1 hour in prod, sample one live request per surface, confirm cache-control markers are present and cached blocks are ≥ 1024 tokens.
- Success criterion: after the fix, `cache_read_input_tokens > 0` on ≥ 50 % of Sonnet rows for `general_chat`, `investor_chat`, `extension_listing_analysis`, `preferences_assistant` over a 24 h window.

**ETA:** 4–6 h (provider split is small; caller audit is the bulk).

## Issue 3 — 14 Haiku errors on 2026-06-29: all HTTP 400

Direct query on the 14 rows: every one is `api_name='claude-haiku-4-5'`, `status='error'`, `error_code='400'`, `request_id=NULL`. All from `_shared/memory/extractor.ts:71` (only caller of `memory_categorization`). All fired in a 9-second burst suggesting one user session flushed 14 conversations through the extractor at once.

**Root cause (high-confidence):**
- `extractor.ts:78` passes `responseFormat: 'json'` in the `ChatRequest`, but `anthropicProvider.buildBody` **never reads that field** — Anthropic doesn't accept an `openai`-style `response_format`. So that's a no-op, not the cause.
- Real cause is almost certainly the payload: the extractor uses `SYSTEM_PROMPT` (~450 tokens) with `cache_control: ephemeral`. On some Anthropic model+version combinations, cache_control on a system block below the 1024-token minimum returns 400 *"cache_control is only supported…"* rather than being silently ignored. This matches Haiku 4.5 rejecting the request while Sonnet accepts it, and the 14 rows all failing identically.
- `request_id` is null because `AnthropicProvider.sendRequest` throws with only the status + first 500 chars of the body; the router logs `error_code=String(err.status)` but never captures the response body or Anthropic's `request-id` header.

**Fix scope:**
- In `AnthropicProvider.buildBody`, only attach `cache_control` when the block is likely ≥ 1024 tokens (rough heuristic: `text.length >= 4000` chars) OR make it opt-in per `ChatRequest`.
- Extend `ProviderError` to carry the response body (redacted) + `request-id`, and persist both into `ai_usage_log.error_code` / a new `error_message` column so we don't guess next time.
- Once wired, re-run the extractor path against Flash Lite (which is where `memory_categorization` routes today) — Flash Lite has a 1 M context and different minimums, so the same payload should not 400. If it does, we'll see the exact body from the new logging.

**Verification:** trigger the memory-extractor path from a real chat (send a >40-char conversation, wait for the sweeper), confirm at least one `memory_categorization` row lands with `status='ok'` and `api_name='google/gemini-3.1-flash-lite'`. Do **not** close until we see a green row.

**ETA:** 2 h (small provider tweak + one extra `error_message` column + a real-traffic smoke through the memory sweeper).

## Issue 4 — `is_dev_call` is always false

**Root cause: `buildRouterContext` exists but no edge function uses it.**

`_shared/ai/router.ts:71–79` defines the helper that extracts `origin` from the inbound `Request`. `rg buildRouterContext supabase/functions` returns exactly one hit — the definition. Every real caller builds the router context by hand (e.g. `ai-chat/index.ts:404`, `investor-chat/index.ts:1392`, `investor-brief/index.ts:309`), passing only `{ userId, tier }`. Neither `origin` nor `isDevCall` is set, so `resolveIsDevCall(ctx)` at `router.ts:129` always returns `false`, and `logUsageAsync` writes `is_dev_call: false` for every row (`usageLogger.ts:77`).

The `isDevOrigin` matcher itself is correct; it just never receives an origin.

**Fix scope:**
- Update every `completeWithFallback` / `streamWithFallback` call site to build ctx through `buildRouterContext({ userId, tier, requestId }, req)`. Call sites to touch: `ai-chat/index.ts` (×4), `investor-chat/index.ts`, `investor-brief/index.ts`, `ai-analyze/index.ts`, `owned-property-chat/index.ts`, `preferences-assistant/index.ts`, `send-weekly-picks/index.ts` (this one has no inbound `Request` — pass `{ isDevCall: false }` explicitly), `_shared/memory/extractor.ts` (background sweeper — same, explicit `false`), `_shared/ai-gateway.ts` router path.
- Add a lint/CI check (grep test) that fails if `completeWithFallback(` appears without a sibling `buildRouterContext` or explicit `isDevCall` — prevents regression.

**Verification:** after deploy, Pedro reloads the app on `id-preview--*.lovable.app` and sends one chat message. Query `SELECT count(*) FROM ai_usage_log WHERE is_dev_call=true AND created_at > now() - interval '10 minutes'` and confirm it returns ≥ 1. Then check a production origin (`homelensais.com`) and confirm its row lands with `is_dev_call=false`.

**ETA:** 1.5 h (mechanical edit across ~9 files + verification).

## Suggested execution order

1. **Issue 4** first (small, unblocks Pedro's own testing not polluting metrics).
2. **Issue 3** next (unblocks Issue 1's verification — Flash Lite calls need to actually work).
3. **Issue 1** (map cleanup + wire missing ops).
4. **Issue 2** (biggest scope; needs live request logging before we know exact fix per surface).

Total: ~11–14 h across all four, plus ~24 h of production observation for Issue 2's post-fix cache-hit-rate check.
