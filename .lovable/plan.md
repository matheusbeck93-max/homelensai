

## Goal
Tighten response style further so simple factual questions stay 1–3 sentences with no structure, and decision-based questions open with a clear yes/no or likely conclusion. Suppress default "next steps" unless they add real value.

## Scope
Prompt-layer only. No logic, contracts, schemas, parsers, models, or frontend changes. Build error reported is infra (R2 upload timeout) — unrelated to code; will resolve on next deploy.

## Files to Edit (system prompts only)

1. **`supabase/functions/perplexity-chat/index.ts`** — main conversational engine. Add explicit rules for the two response shapes (factual vs decision) and the "no default next steps" rule. Keep verbatim: citation suppression, role/merge logic, Markdown rules.

2. **`supabase/functions/property-assistant/index.ts`** — refine the system message with the same two-shape rules. Links contract untouched.

3. **`supabase/functions/ai-chat/index.ts`** — minimal high-level addition only ("simple → 1–3 sentences, decision → lead with conclusion, skip next-steps unless useful"). Do NOT touch uiBlock/searchParams contract.

4. **`supabase/functions/calculator-insights/index.ts`**, **`ai-analyze/index.ts`**, **`compare-properties-ai/index.ts`** — light tone refinement. Keep numbered output sections, persona logic, and structural requirements verbatim.

5. **`supabase/functions/ai-analyze-property/index.ts`** — leave the 6 fixed sections intact (they are inherently structured/decision-based, so the new rules don't apply to factual-shape there). Only refine the closing "GENERAL TONE" lines to add: "Skip next-step suggestions unless they materially help the decision."

## Editing Principle (per file, not one-size-fits-all)

Add only these new rules where a free-form tone block exists:

- **Simple factual** → 1–3 sentences, no headings, no bullets, no follow-ups.
- **Decision-based** → first sentence = yes/no or likely conclusion; no ambiguous openers.
- **Next steps / follow-ups** → only when they add clear value; never default.

These rules layer on top of the existing "answer-first / relevance-filter / personalization-as-relevance" instructions already in place — no contradictions, no duplication.

## Hard Guarantees

- All JSON contract sentences (uiBlock, searchParams, links array, MATCH_SCORE prefix, citation suppression, 6 fixed analysis sections) remain verbatim.
- No model, temperature, max_tokens, schema, parser, or tool change.
- No frontend change.
- Personalization injection logic untouched.

## Memory Update

Update `mem://ai/estilo-de-comunicacao-objetiva-e-direta` to reflect the two new rules (factual shape vs decision shape, no default next steps). Update `mem://index.md` Core line for AI Tone accordingly.

## Validation Plan

After deploy, run these chat smoke tests:

1. **Simple factual** — "What is PMI?" → 1–3 sentences, no headings, no bullets, no "next steps".
2. **Simple factual** — "What's a typical closing cost percentage?" → same shape.
3. **Decision-based** — "Should I buy a $700k home on $130k income?" → first sentence = clear yes/no/likely; key factors after; takeaway only if useful.
4. **Decision-based** — "Is it better to put 10% or 20% down right now?" → opens with conclusion, not "it depends".
5. **Property analysis URL** — still returns the 6 fixed sections verbatim.
6. **searchParams trigger** — "Find 3-bed homes in Austin under $500k" → JSON contract intact.
7. **uiBlock trigger** — "Build me a mortgage calculator" → uiBlock JSON intact.
8. **Personalization used** — saved $400k budget user asks "Is this $700k home a stretch?" → conclusion-first, leverages budget, no profile echo.
9. **Personalization NOT forced** — same user asks "What is escrow?" → 1–3 sentence factual answer, no profile injection, no follow-ups.

Pass criteria: all parsers continue to work; factual answers are visibly tighter; decision answers lead with the verdict; gratuitous "next steps" disappear from simple replies.

