## Goal
Make the Conversational Intelligence layer demonstrably alive in the main `/chats` surface and instrument it.

## 1. `ai-chat` → emit CI signals (biggest unlock)
`supabase/functions/ai-chat/index.ts` has 3 model-call paths:
- **Extension path** (~L372) — `gemini-2.5-flash` with `matchScoreInstructions`
- **Firecrawl path** (~L834) — same model with `firecrawlMatchScoreInstructions`
- **Main path** (~L1741) — primary `/chats` path

For each path:
- Append `ciSignalsPromptBlock()` (from `_shared/conversationalSignals.ts`) to the system message, **after** any MATCH_SCORE instructions so it doesn't disturb the score prefix.
- After the model responds, run `extractCiSignals(text)` on the final assistant text. Replace the returned text with `cleanText` and attach `signals` to the JSON response (`{ message, signals }`), matching `owned-property-chat` shape.
- Preserve all existing fields (matchScore, structured tool output, etc.).

Frontend (`src/pages/Chats.tsx`) already maps `metadata.ciSignals → turn.signals`, so no client change needed once `ai-chat` returns `signals`.

## 2. Purchase Plan PDF — verification + small fixes
- Curl `generate-artifact` with `{ kind: "purchase_plan_pdf", input: { home_price: 650000, address: "Austin, TX", surface: "general_chat" } }` against a logged-in session.
- Confirm: PDF downloads, opens cleanly, 2 pages, branded colors, `artifact_generation_log` row inserted, daily counter increments, signed URL valid.
- Fix any rendering issues found (clipped text, missing fields, wrong filename slug).
- Confirm `cap_reached` path returns `{ error: 'daily_cap_reached', ... }` so the new upgrade CTA card renders.

## 3. Web telemetry
Add a tiny `_shared`-style logger on the client: `src/lib/conversationalIntelligence/telemetry.ts` exporting `trackCiEvent(name, props)` that inserts into existing `tool_call_telemetry` table (already has user_id-scoped RLS).

Wire 5 events:
- `web_followup_shown` — fired in `ConversationalIntelligence.tsx` when followups.length > 0 on mount of a turn (debounced by turn id)
- `web_followup_chip_clicked` — in `handleChip` with action.type + label
- `web_followup_mismatch_accepted` / `_dismissed` — in `PreferenceFollowupCardWeb` accept/dismiss handlers
- `web_artifact_generated` / `web_artifact_cap_reached` — in `handleChip` after `onGenerateArtifact` result

Keep payload shape `{ surface, kind, label, ... }` mirroring extension events.

## Out of scope (next batch)
- `investor-chat` streaming signal parser
- Mounting on Investor chat composer + InvestorBrief deep dive
- `property_report_pdf` / `chart_image` renderers (need resvg-wasm)
- Console "Saved artifacts" view
- Chrome extension migration to shared signals module
- Free-tier cap recalibration

## Verification
- Send "Show me a $900k house in Austin" in `/chats` with a budget-capped profile → assistant returns text with no visible JSON, "Budget mismatch" card appears, "Generate purchase plan" chip appears → click → PDF downloads → telemetry rows appear in `tool_call_telemetry`.
- Re-trigger after daily cap → upgrade CTA card renders.

## Risk
`ai-chat` is 1990 lines with 3 model-call paths and an existing MATCH_SCORE contract. Risk of breaking the score prefix. Mitigation: append CI block as a **separate** trailing message, not in-line with MATCH_SCORE instructions; `extractCiSignals` is regex-anchored to end-of-text so it won't strip the MATCH_SCORE prefix.
