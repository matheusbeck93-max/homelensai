

## Goal
Refine assistant response *style* across all prompt layers without altering any logic, contracts, or structured-output instructions.

## Discovery (already mapped)
System prompts live in:
1. `supabase/functions/perplexity-chat/index.ts` — Search + URL Analysis modes (heavy conversational layer)
2. `supabase/functions/ai-chat/index.ts` — Workflow / uiBlock generator (heavy structured-output contract)
3. `supabase/functions/property-assistant/index.ts` — Follow-up chat (light, mixed with link contract)
4. `supabase/functions/ai-analyze-property/index.ts` — Structured property analysis (6 fixed sections)
5. `supabase/functions/compare-properties-ai/index.ts` — Comparison narrative
6. `supabase/functions/ai-analyze/index.ts` — Investor narrative
7. `supabase/functions/calculator-insights/index.ts`, `neighborhood-personality/index.ts`, `neighborhood-insights/index.ts`, `market-snapshot/index.ts`, `market-trends/index.ts` — will scan for any conversational tone instructions and refine only where present.

I will do one more pass with `code--search_files` for `system` / `systemPrompt` / `role: 'system'` to confirm no prompt layer is missed before editing.

## Editing Principle (per file, NOT one-size-fits-all)

- **Do not** inject the same style block everywhere.
- **Do not** touch any sentence describing JSON shape, uiBlock schema, searchParams, links array, citation suppression, section headings, or output format. These remain **verbatim**.
- Style refinements are inserted only into the *tone/behavior* sections that already exist, and sized to each function's role.

### Per-file plan

**`perplexity-chat/index.ts`** (largest impact)
- Rewrite the conversational-tone paragraphs in both Search and URL-analysis system prompts.
- Add: answer-first, adapt-to-complexity, prioritization (state/local first), relevance filter, scanability, decision-oriented close, personalization-as-relevance-layer.
- Keep verbatim: citation suppression rules, Markdown structure rules already enforced for the frontend, role/merge logic comments.

**`ai-chat/index.ts`** (minimal, high-level)
- Add a short 3–5 line style note above the existing prompt body: "answer-first, no preambles, prioritize highest-impact info, end medium/complex answers with a clear takeaway."
- Do NOT touch the uiBlock/searchParams/JSON contract block at all.

**`property-assistant/index.ts`**
- Replace only the single-line system message with a tightened version (answer-first, decision-oriented, no filler). Links contract untouched.

**`ai-analyze-property/index.ts`**
- Refine only the "GENERAL TONE" block at the bottom. The 6 numbered structural rules and section headings stay verbatim.

**`compare-properties-ai/index.ts`** and **`ai-analyze/index.ts`**
- Refine the tone sentences only. Numbered output sections, persona logic, and word limits stay verbatim.

**Other functions (calculator-insights, neighborhood-*, market-*)**
- Inspect; only adjust if a free-form tone instruction exists. Skip if the prompt is purely structured.

## Hard Guarantees

- No JSON contract sentence is rewritten, reordered, paraphrased, or weakened.
- No schema, tool, model, temperature, max_tokens, or parsing logic changes.
- No frontend changes.
- Personalization data injection unchanged; only the *instruction on how to use it* is refined (use as relevance layer, never echo back).

## Validation Plan (expanded)

After deployment, run these end-to-end smoke tests via the chat UI and inspect responses + raw payloads:

1. **Plain factual** — "What is PMI?" → expect 1–3 sentences, no headings, no preferences echoed.
2. **Affordability** — "Can I afford a $600k home on $120k income?" → answer-first, structured key factors, takeaway; assumptions separated.
3. **Property analysis** — paste a listing URL → still returns the 6 fixed sections verbatim (Data Snapshot → Questions to Ask).
4. **searchParams contract** — "Find 3-bed homes in Austin under $500k" → response still contains the exact JSON / searchParams payload the frontend parses.
5. **uiBlock contract** — "Build me a mortgage calculator" / "Run an investor ROI plan" → response still contains the exact uiBlock JSON the frontend renders.
6. **Personalization used** — user with saved budget $400k asks "Is this $700k home a stretch?" → answer leverages budget without restating the full profile.
7. **Personalization NOT forced** — same user asks "What is escrow?" → factual answer only, no profile injection.

Pass criteria: all parsers (uiBlock, searchParams, citations regex, links array) continue to work; tone/structure visibly improved per principles above.

## Out of Scope
Frontend, schemas, models, tools, memory writes, env vars.

