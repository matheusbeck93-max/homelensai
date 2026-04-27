## Goal

When the AI's reply contains numeric calculations (loan snapshot, affordability, mortgage breakdown, ROI, etc.), the chat should render them like the screenshots:

- A bold title with a small icon
- A clean 2-column **Label → Value** table with thin horizontal dividers
- An optional callout block (gray side-bar) underneath for the key takeaway

This is achieved by (A) telling the AI to format calculation summaries with a specific markdown pattern, and (B) rendering that markdown properly in the chat UI.

---

## What changes

### 1. Render markdown tables and blockquotes (frontend)

Currently `src/pages/Chats.tsx` and `src/components/ConversationPanel.tsx` use `react-markdown` **without `remark-gfm`**, so any markdown table the AI sends is ignored. We will:

- Add `remark-gfm` to `react-markdown` in both components.
- Add styled renderers for `table`, `thead`, `tbody`, `tr`, `th`, `td` that match the screenshot:
  - Full-width table, no outer border
  - Thin `border-t border-border` between rows
  - Label left-aligned (muted-foreground), value right-aligned (foreground, semibold for currency)
  - Comfortable vertical padding (`py-3`)
- Add a styled `blockquote` renderer for the callout: left border (`border-l-4 border-muted`), padded, slightly muted background, used for the "PMI is not required..." style note.
- Keep the existing `a`, `p`, `ul`, `li` overrides; the new `ul/li` rule should only apply to bullets that are NOT inside a table.

Same changes applied to `ConversationPanel.tsx` and `ChatComparisonPanel.tsx` so the look is consistent everywhere markdown is rendered.

No new component is created — we lean on markdown + tailwind styling, matching the project's "non-destructive, incremental additions" rule.

### 2. Teach the AI to use this format (backend, prompts only)

Update the system prompts in `supabase/functions/ai-chat/index.ts` and `supabase/functions/perplexity-chat/index.ts` (general/L2/L3 branches) to add a "NUMERIC SUMMARY FORMAT" rule:

> When your answer includes a set of related numeric figures (loan snapshot, affordability breakdown, mortgage P&I, monthly cost stack, ROI summary, etc.), present them as a markdown table with two columns: **Label** and **Value**. Title the block with a bold heading on the line above (e.g. `**Your Loan Snapshot**`). After the table, if there's a key takeaway, put it in a `>` blockquote on its own line.

Concrete example shipped in the prompt:

```
**Your Loan Snapshot**

| Label | Value |
|---|---|
| Home Price | $1,000,000 |
| Down Payment | $200,000 (20%) |
| Loan Amount | $800,000 |
| Rate (30yr fixed, VA ~Apr 2026) | ~6.75% APR |
| Est. Monthly P&I | ~$5,190 |

> PMI is not required — your 20% down clears that threshold. That's a meaningful saving (~$200–$300/mo that other buyers at lower down payments carry).
```

Rules added to the prompt:
- Use this format whenever there are 3+ related numeric rows. Below 3, inline prose is fine.
- Always 2 columns only (Label, Value). Never invent extra columns.
- Currency stays formatted with `$` and commas. Use `~` for estimates, exactly like the example.
- No emojis in the table itself; the bold title above the table may use one only if it adds clarity (the screenshots use a small house/coin glyph).
- Keep this consistent with the existing **Decision-First** rule: the verdict/answer comes first, then the table, then the callout.

### 3. Memory

Add a short memory note documenting the contract so future prompt edits don't drift:

`mem://ui/numeric-summary-table-format` — "Numeric breakdowns render as a 2-col markdown table (Label | Value) with a bold title above and an optional `>` blockquote takeaway below. Frontend renders with remark-gfm + custom table/blockquote styling in Chats.tsx, ConversationPanel.tsx, ChatComparisonPanel.tsx."

Update the index.md memories list to reference it.

---

## Out of scope

- No new uiBlock / no new React component for calculations. Markdown is enough and keeps the AI in control.
- No change to the existing `workflow_excel` / portal-links offer-and-accept rules.
- No change to the calculator pages or `InlineCalculator`.
- TextToSpeech sanitization already strips markdown punctuation; tables will be read as plain text — acceptable, no change needed.

---

## Files touched

- `src/pages/Chats.tsx` — add `remark-gfm`, table/blockquote renderers.
- `src/components/ConversationPanel.tsx` — same.
- `src/components/chat/ChatComparisonPanel.tsx` — same.
- `package.json` — add `remark-gfm` dependency.
- `supabase/functions/ai-chat/index.ts` — add NUMERIC SUMMARY FORMAT block to the general system prompt.
- `supabase/functions/perplexity-chat/index.ts` — add the same block to the general/L3 branch system prompt.
- `mem://ui/numeric-summary-table-format` (new) and `mem://index.md` (add reference).
