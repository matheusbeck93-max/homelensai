# Phase 3 continuation: AI signal producers + Purchase Plan PDF

Two workstreams that unblock the Conversational Intelligence layer already wired into the web. UI is built and waiting — this turn lights it up end-to-end.

## Workstream A — AI-side structured signals

Currently the web `<ConversationalIntelligence>` only falls back to client-side `detectMismatches`. The AI never returns the structured fields the layer was designed around. Add them to three chat backends.

**Contract (shared, documented in `_shared/conversationalSignals.ts`):**
Assistant responses may include a trailing JSON block fenced as ` ```ci-signals ` containing:
```
{
  "mismatch_signals": [
    { "type": "location" | "budget_over" | "budget_under" | "property_type" | "min_beds" | "min_baths" | "min_sqft" | "target_cap_rate",
      "severity": "blocker" | "major" | "minor",
      "detected_value": <any>,
      "preferred_value": <any> }
  ],
  "suggested_followups": [
    { "label": string,                              // <= 28 chars
      "action": { "type": "send_message", "text": string }
        | { "type": "call_tool", "name": "generate_mortgage_excel" | "generate_purchase_plan_pdf" | "generate_property_report_pdf" | "generate_chart_image", "input"?: object } }
  ]
}
```

**Backends to update:**
1. `supabase/functions/ai-chat/index.ts` — append a "Structured signals" section to the system prompt; parser strips the fenced block from streamed text before delivery and attaches it to the final assistant turn via existing message metadata channel.
2. `supabase/functions/owned-property-chat/index.ts` — same prompt addendum, scoped to owned-property mismatches (only `target_cap_rate` + `budget_*` make sense).
3. `supabase/functions/investor-chat/index.ts` — same, plus enable `generate_mortgage_excel` and `generate_purchase_plan_pdf` chips.

**Frontend plumbing (already exists, just wire):**
- `ChatTurn.signals.mismatch_signals` and `ChatTurn.signals.suggested_followups` are already typed in `src/lib/conversationalIntelligence/types.ts`.
- Each surface (`/chats`, `PropertyChat`, `FollowUpChat`) already reads `lastAssistant.signals`. Update each surface's message→ChatTurn mapper to copy the parsed `ci-signals` block from message metadata into `signals`.
- Add `suggestFollowups` fallback path: when AI-supplied `suggested_followups` exist, prefer them over the heuristic.

**Telemetry:** new client events `web_followup_shown`, `web_followup_chip_clicked`, `web_followup_mismatch_accepted`, `web_followup_mismatch_dismissed` via `src/lib/telemetry/usageEvents.ts`. Fired from `FollowupChipRow` and `PreferenceFollowupCardWeb`.

## Workstream B — Purchase Plan PDF renderer

Add `purchase_plan_pdf` to `supabase/functions/generate-artifact/index.ts` using `pdf-lib` (Deno-compatible, already approved stack).

**Inputs:** `{ home_price, down_payment_pct?, interest_rate?, address?, city?, state?, surface }` — all optional except `home_price`; missing fields fall back to sensible defaults documented inline.

**Output:** 2-page PDF
- Page 1 — Purchase summary: address, list price, recommended offer band, estimated cash-to-close, monthly PITI, debt-to-income guidance.
- Page 2 — 12-month action checklist (pre-approval, inspection windows, closing milestones) with checkbox glyphs.

Styling matches brand: steel blue `#6B8DB5` headers, dark `#2C3E55` body, Helvetica (pdf-lib built-in — no font fetching).

**Caps (per existing `artifact_generation_log` table):**
- Free: 1/day, Buyer: 10/day, Investor: 50/day.
  Lower than mortgage excel because PDF generation is heavier; revisit after cost telemetry lands.

**Wiring:**
- `ArtifactCard.tsx` already handles arbitrary `GeneratedArtifact.kind`. No change needed.
- `ConversationalIntelligence.tsx` `kindMap` already includes `generate_purchase_plan_pdf → purchase_plan_pdf`. No change needed.
- Add filename: `purchase-plan-{address-slug}-{YYYYMMDD}.pdf`.

**QA:** generate one PDF locally via `curl_edge_functions`, convert with `pdftoppm`, visually verify both pages — fix overflow/clipping before claiming done.

## Out of scope (next prompt candidates)

- `property_report_pdf` + `chart_image` (need resvg-wasm setup; defer until purchase-plan flow validated).
- Investor chat + InvestorBrief deep-dive surface mounting (defer one turn — they need the AI-side signals from this turn first to be useful).
- Cap-reached upgrade CTA on `ArtifactCard`.
- Console "Saved artifacts" list page.
- Chrome extension migration from legacy `PreferenceFollowupCard` to shared module.
- Cost-based recalibration of free-tier caps.

## Verification checklist

1. Send a property-analysis message in `/chats` for a listing that exceeds saved budget → AI response strips the `ci-signals` fence; a "Budget mismatch" follow-up card renders above composer; a "Generate purchase plan" chip appears.
2. Click "Generate purchase plan" → `ArtifactCard` shows pending → ready with download link; PDF opens to a clean 2-page document.
3. `artifact_generation_log` row inserted with `kind=purchase_plan_pdf`; daily cap increments correctly.
4. `tool_call_telemetry` rows for the 4 new web events fire at expected moments.
5. Owned-property chat: ask "is my cap rate on track?" → response includes a `target_cap_rate` mismatch signal when applicable.
