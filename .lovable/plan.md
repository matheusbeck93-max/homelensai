

## Goal
Tighten responses by 15–20% and prefer bullets when they improve scanability, **without losing analytical depth or breaking any contracts**.

## Scope
Prompt-layer only. Same edge functions as before. No logic, schema, parser, model, or frontend change.

## Editing Principle

Add to the existing tone blocks (where they already exist) two new style rules:

1. **Conciseness target**: cut filler ~15–20%; every sentence must add information (cost, risk, eligibility, fit, decision). No restating the question, no transitional padding.
2. **Prefer bullets when they improve scanability**: for medium/complex answers with 3+ supporting points, render them as a flat bullet list instead of long prose paragraphs. Keep bullets short (one idea each, ≤2 lines). Use paragraphs when 1–2 connected points read more naturally as prose, or for the opening verdict sentence. Never bullet simple factual answers.

Keep verbatim:
- Simple-factual rule (1–3 sentences, no bullets) — bullets stay forbidden there.
- Decision-first rule (verdict sentence opens, then bullets when they help).
- All JSON/uiBlock/searchParams/MATCH_SCORE/citation/6-section contracts.

## Files to Edit

- `supabase/functions/perplexity-chat/index.ts` — main impact, conversational engine.
- `supabase/functions/property-assistant/index.ts` — short follow-up assistant.
- `supabase/functions/ai-chat/index.ts` — minimal addition only; do NOT touch uiBlock/searchParams contract.
- `supabase/functions/ai-analyze-property/index.ts` — only the GENERAL TONE block; 6 sections stay verbatim.
- `supabase/functions/ai-analyze/index.ts` — tone lines only.
- `supabase/functions/compare-properties-ai/index.ts` — tone lines only.
- `supabase/functions/calculator-insights/index.ts` — tone lines only.

## Memory Update

Update `mem://ai/estilo-de-comunicacao-objetiva-e-direta` with the two new rules (conciseness 15–20%, prefer bullets when they improve scanability). Update `mem://index.md` Core line accordingly.

## Hard Guarantees

- No contract sentence rewritten/reordered.
- Simple factual answers still 1–3 sentences with NO bullets.
- Decision answers still open with verdict, then bullets when they help scanability.
- No model/temperature/schema/parser/frontend change.

## Validation

Re-run the existing 9 chat smoke tests; additionally check that decision-based and analytical answers (affordability, comparisons, neighborhood, calculator insight) now use bullets for the supporting factors when they improve scanability and read ~15–20% shorter, while structured outputs (uiBlock, searchParams, MATCH_SCORE, 6 sections) still parse correctly.
