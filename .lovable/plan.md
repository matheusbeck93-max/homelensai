## Pre-flight check

- `user_memories` is populating: **2,784 rows, latest insert today**. The cascade-to-memory loop is unblocked.
- Existing infra to build on: `src/lib/conversationalIntelligence/` (wrapper, `FollowupChipRow`, `suggestFollowups`, `types.ts`), `_shared/memory/{updater,retriever,prune}.ts`, `_shared/ai/`, `perplexity-chat` edge function.
- The current `suggestFollowups` is tool-call-driven and shallow. We extend (don't replace) it with a registry-based ranker plus cascade execution.
- Open Houses topic is dropped (matches recent removal).

## Topics in v1 (5)

1. `test_buying_ability` — financing
2. `fthb_programs` — financing (first-time-buyer persona only)
3. `lender_info` — financing
4. `compare_properties` — analysis
5. `neighborhood_research` — research

Remaining 9 topics from the spec deferred to v1.1 once telemetry validates pattern.

## PR A — Registry, triggers, ranking (~1.5 days)

New files in `src/lib/conversationalIntelligence/`:

- `followupRegistry.ts` — exports 5 `FollowupTopic` entries matching spec shape (id, label, category, persona_affinity, trigger, cooldown_minutes, on_accept).
- `triggerDetection.ts` — ~20 small regex predicates over recent thread (`mentionsBudget`, `mentionsMortgage`, `mentionsLender`, `mentionsRates`, `mentionsPreApproval`, `mentionsFirstHome`, `mentionsDownPayment`, `mentionsAffordability`, `mentionsAssistance`, `mentionsMultipleProperties`, `userHasSavedProperties`, `mentionsDecisionBetween`, `mentionsLocation`, `mentionsSchools`, `mentionsCrime`, `mentionsCommute`, `userViewingProperty`, etc.). Each scans the last 3-5 messages.
- `rankFollowups.ts` — combines `trigger(ctx) * personaWeight` (persona = 30-40% prior, conversation signals = 60-70%), filters by `score >= 0.3`, applies cooldown and dismissal rules, returns top 3.
- `followupDismissals.ts` — localStorage-backed tracker: per-user `{topicId: {dismissCount, lastShownAt, lastDismissedAt}}`. 30-min cooldown default, 7-day suppression after 3 dismissals.
- Extend `types.ts` with `FollowupTopic`, `CascadeNode`, `FollowupAction` (cascade | tool_call | composite), `ConversationContext` (extend existing `ConversationalContext`), `PersonaWeight`.
- Wire `suggestFollowups.ts` to prefer registry results, fall back to existing tool-call mappings.

Persona resolution reuses `src/lib/personas/` (already exists for buyer-type detection).

## PR B — Sonnet + Perplexity backed tools (~2 days)

Backend tools in `supabase/functions/_shared/ai/tools/`:

- `findLocalLenders.ts` — Perplexity `sonar` (recency=day) → Gemini structured extraction → `{lenders, median_rate_apr, summary, next_question}`. Cached 12h in `search_cache`.
- `findFTHBPrograms.ts` — Perplexity lookup by state+county. Cached 7 days. Structured output: `{programs[], eligibility_summary, next_question}`.
- `researchNeighborhood.ts` — five sub-tools (`research_schools`, `research_crime`, `analyze_commute`, `research_zoning_dev`, `research_neighborhood_comprehensive`). Cached 30 days by ZIP+topic. Reuses existing `neighborhood-insights` edge function patterns.
- `testBuyingAbility.ts` — combines existing `calcEngine.ts` with `get-state-tax-data` + Perplexity for current 30y fixed rate (12h cache). Output: max purchase price, PITI breakdown, DTI ratios.
- `compareProperties.ts` — orchestrates existing `compare-properties-ai` for N properties from saved set or thread context.

Cache layer uses existing `search_cache` table with topic-specific TTLs. All tools follow `_shared/` pattern: pinned esm.sh, Zod validation, structured logging, CORS.

Registered in tool registries of: `ai-chat`, `investor-chat`, `owned-property-chat`, `property-assistant`, `extension-followups`.

## PR C — Cascade execution + system prompt updates (~1 day)

**Status: shipped.**

- Added `_shared/ai/followupSystemPrompt.ts` (FOLLOW-UP CASCADE block) and injected into `ai-chat` (main/extension/firecrawl), `investor-chat` (CI_SIGNALS_BLOCK), `owned-property-chat`. Skipped `property-assistant` (no tool loop) and `extension-followups` (CRUD, not chat).
- Added `FOLLOWUP_TOOL_DEFS` adapter to `_shared/ai/tools/followups/index.ts`. Spread into investor-chat and owned-property-chat `TOOLS`. Spread `FOLLOWUP_TOOLS` (raw shape) into ai-chat `tools`.
- Extended ai-chat's tool-result loop to dispatch any `isFollowupTool(name)` call alongside `web_research`, with the same one-pass tool-result re-call.
- Added `src/lib/conversationalIntelligence/followupExecutors.ts` + wired `maybeEndCascadeFromTurn` into the wrapper to clear `activeCascade` when the expected tool fires.

- `src/lib/conversationalIntelligence/followupExecutors.ts` — given a `FollowupTopic.on_accept`, returns the message to send to AI (cascade prompt) or the tool name + extracted input.
- Cascade state tracker — when a cascade is active, suppress new topic chips (`isCascadeActive(ctx)`).
- Extend `ConversationalIntelligence.tsx` to:
  - Render registry-derived chips (existing `FollowupChipRow` works as-is).
  - Track `activeCascade` per thread.
  - On chip click: fire telemetry, persist `lastShownAt`, dispatch action through existing `onChipAction`.
- System prompt addition (`FOLLOW-UP CASCADE` section) injected into each chat surface's system prompt builder:
  - `supabase/functions/ai-chat/`
  - `supabase/functions/investor-chat/`
  - `supabase/functions/owned-property-chat/`
  - `supabase/functions/property-assistant/`
  - `supabase/functions/extension-followups/`
  - Lists the 5 v1 topics + cascade contract (collect inputs first, then call tool; stay in cascade until complete).

## PR D — Surface integration, memory, telemetry (~1 day)

- Mount registry chips in every surface that uses `<ConversationalIntelligence />`. Confirm: `Chats.tsx`, `InvestorChat`, `PropertyChat`, `DeepPanel`, extension popup. Extension uses 2-chip cap and lower trigger threshold (`score >= 0.4`).
- Memory persistence: in cascade completion handler, write captured data points (income, debts, down payment, state, county) to `user_memories` via existing `memory/updater.ts`. Only persist `importance >= 0.7`.
- Telemetry events in `src/lib/telemetry/`:
  - `followup_chip_shown`, `followup_chip_clicked`, `followup_cascade_entered`, `followup_cascade_completed`, `followup_cascade_abandoned`, `followup_perplexity_called`.
- Update `mem://index.md` with a Followup Registry entry.

## Verification checklist (run after PR D)

- 5 manual smoke tests from the spec (first-time-buyer Texas, buying ability cascade, memory rows, cross-session reference, extension on Zillow, investor compare, owned-property refi suppression, 3-topic interference, 3-dismissal suppression, never >3 chips, cascade chip suppression, Perplexity caching, telemetry events).
- `supabase--read_query` against `user_memories` after a buying-ability cascade to confirm 3 new context rows.
- Manual trigger of each cascade in dev preview.

## Technical notes

- Persona affinity uses existing `profiles.persona`/buyer-type fields; resolver lives in `src/lib/personas/`.
- Cooldown/dismissal state is per-user localStorage (`hl_followup_state_v1`). No new table needed.
- All new edge tools deploy automatically; no `config.toml` edits.
- Tools that need Perplexity: ensure `PERPLEXITY_API_KEY` (already configured).
- No DB migrations required (uses existing `user_memories`, `search_cache`, `tool_call_telemetry`).
- Decision-First tone preserved: cascade prompts to AI are direct, no "would you like to…" filler.
- English only.

## Out of scope (matches spec v2)

Topics 6-15, voice cascades, multilang, A/B testing chip copy, user-customizable disables, persona-specific wording, analytics dashboard.

## Open question (non-blocking)

Should the 5 v1 topics get unique cooldown overrides (e.g. FTHB 7d, lender 24h, neighborhood 7d) or all use the 30-min default? I'll default to per-topic overrides matching the spec's "topic-specific overrides possible" guidance unless you say otherwise.
