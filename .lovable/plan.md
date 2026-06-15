## Goal

Make macro questions ("Is Tampa still good for rentals?", "Should I invest in Austin?") render in a consistent **MacroAnswerCard** instead of free-form prose. The card matches the selected "Structured insights card" direction: bold takeaway → 2x2 metrics grid → confidence bar → optional source footer.

## Approach

Extend the existing `ci-signals` fenced block (which the AI already emits) with an optional `macro_answer` payload. When present, the chat surfaces render `<MacroAnswerCard />` in place of plain prose. Follow-up chips continue to render below via the existing `<ConversationalIntelligence />` wrapper.

## Files

### 1. Shared signals contract — `supabase/functions/_shared/conversationalSignals.ts`
- Add `MacroAnswer` type:
  ```
  {
    takeaway: string;                                    // bold one-liner
    metrics: Array<{ label: string; value: string;       // 2-4 items
                     trend?: "up" | "down" | "neutral" }>;
    confidence?: number;                                 // 0–100
    source_note?: string;                                // short attribution line
  }
  ```
- Add `macro_answer?: MacroAnswer` to `CiSignals`.
- Extend `extractCiSignals` to validate + parse it (takeaway string, metrics 2–4 with string label/value, confidence in 0–100, source_note ≤ 140 chars).
- Update `ciSignalsPromptBlock` to document the new optional field in the fence schema.
- Update `ciBehaviorPromptBlock` rule 6 (MACRO ANSWER SHAPE): when intent is MACRO, MUST emit `macro_answer` and keep prose to AT MOST one short lead-in line — the structured card carries takeaway + metrics + confidence.

### 2. Frontend types — `src/lib/conversationalIntelligence/types.ts`
- Mirror `MacroAnswer`; add `macro_answer?` to `ChatTurn.signals`.

### 3. New component — `src/lib/conversationalIntelligence/MacroAnswerCard.tsx`
Built from the selected v2 prototype, ported to project semantic tokens (no hardcoded slate/emerald):
- Outer card: `bg-muted/40 border border-border rounded-2xl p-5 shadow-sm`
- Header chip row: small bot icon + "Analysis" label (`text-muted-foreground`, uppercase, tracking-wider)
- Takeaway: `font-bold text-base leading-snug` (`text-foreground`)
- Metrics: `grid grid-cols-2 gap-y-4 gap-x-6`, each cell has uppercase label (`text-muted-foreground text-[11px]`) over bold value (`text-lg`); trend `up` → `text-emerald-600` (kept via tailwind, acceptable accent), `down` → `text-destructive`
- Confidence: bottom block, label + percent text + progress bar (`bg-muted` track, `bg-primary` fill width=confidence%)
- Optional source footer (`text-[10px] text-muted-foreground`) below card when `source_note` present
- Renders nothing if `takeaway` missing or metrics < 2.

### 4. Helper + exports — `src/lib/conversationalIntelligence/index.ts`
- Re-export `MacroAnswerCard` and a tiny `getMacroAnswer(turn)` helper.

### 5. Surface wiring (main conversational surfaces only)
- **`src/pages/Chats.tsx`** — in the assistant message renderer, if `metadata.ciSignals.macro_answer` is present, render `<MacroAnswerCard />` instead of the plain prose. If the AI still emits prose alongside, render only the lead-in (first line, ≤140 chars) above the card.
- **`src/components/investor/brief/BriefCard.tsx`** — same treatment using `turn.signals.macro_answer`.
- `PropertyChat` and `FollowUpChat`: out of scope (property-bound surfaces; macro questions are not their main use).

### 6. Telemetry — `src/lib/conversationalIntelligence/telemetry.ts`
- Add `web_macro_card_shown` event, fired once per assistant turn that produces a macro card (debounced by turn index).

### 7. Edge deploys
- Deploy `ai-chat`, `investor-chat`, `perplexity-chat`, `owned-property-chat` (shared module changed).

## Out of scope
- Chrome extension surface (small popup, plain text + chips already works).
- Charts / sparklines inside the card.
- Standalone `analyze_market_macro` orchestrator (already deferred).

## Verification
- Sample-payload sanity check on `extractCiSignals` for a macro fence.
- Manual: ask a macro question in `/chats` and confirm card renders with takeaway, 4 metrics, confidence bar; follow-up chips still appear below the composer; light/dark theme both readable.
