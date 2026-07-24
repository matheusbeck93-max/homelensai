## Problem
On the Saved Analyses detail dialog, the "AI Summary" panel (Overview tab) is rendering the raw first paragraph of `analysis_summary` as plain text. So markdown bold (`**No**`) shows literal asterisks, and Perplexity-style citations like `[¹](https://…long-url…)` leak into the copy, breaking the layout.

Screenshot confirms the issue — the panel shows `**No** — this property…` followed by a raw `[¹](https://kentislandkathy.com/…)` link.

## Fix (scoped to `src/pages/SavedAnalyses.tsx`)

1. Add a small `sanitizeSummary(text)` helper that:
   - Removes Perplexity citation link tokens: `[¹²³…](http…)`, `[1](http…)`, and standalone `[¹]` markers.
   - Trims trailing whitespace / dangling punctuation left behind.
2. Compute `firstParagraph` from the sanitized text (still first block before a blank line).
3. Render it with `<ReactMarkdown remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>` inside the AI Summary card instead of a plain `<p>`, so `**bold**` renders as bold and any residual inline links render properly.
4. Apply the same `sanitizeSummary` to the full "Analysis" tab markdown so long citation URLs don't clutter that view either.
5. Also run `sanitizeSummary` through `deriveHighlights` input so bullet highlights don't inherit `**` or citation noise.

No other files, no schema changes, no behavior changes elsewhere.

## Technical notes
- Citation regex: `/\s*\[[¹²³⁴⁵⁶⁷⁸⁹⁰\d]+\]\(https?:\/\/[^)]+\)/g` plus `/\[[¹²³⁴⁵⁶⁷⁸⁹⁰\d]+\]/g`.
- `chatMarkdownComponents` already exists in this file and is used by the Analysis tab — reuse it for visual consistency.
- Wrap the Markdown in the existing `prose prose-sm dark:prose-invert max-w-none` class inside the AI Summary card so typography matches.