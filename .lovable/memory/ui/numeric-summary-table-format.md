---
name: Numeric Summary Table Format
description: Numeric breakdowns (loan snapshot, ROI, cost stack) render as 2-col markdown table (Label | Value) with bold title above and optional blockquote callout. Frontend uses remark-gfm + chatMarkdownComponents.
type: feature
---
When the AI returns 3+ related numeric figures, it MUST format them as:

```
**Title**

| Label | Value |
|---|---|
| ... | ... |

> Optional one-line takeaway.
```

Rules (enforced in system prompts of `ai-chat` and `perplexity-chat`):
- Exactly 2 columns: Label | Value.
- `$` + commas for currency, `~` for estimates.
- Bold title goes on the line ABOVE the table.
- Blockquote (`>`) only for the single key takeaway; skip if nothing to add.
- Decision-First: verdict first (1–2 sentences), then table, then callout.
- Skip the table for fewer than 3 numeric rows — inline prose is fine.

Frontend rendering:
- `src/components/chat/markdownComponents.tsx` exports `chatMarkdownComponents` with styled `table/tr/td/blockquote` renderers (no header row, thin row dividers, label muted-left / value semibold-right, blockquote with left side-bar).
- Used by `src/pages/Chats.tsx`, `src/components/ConversationPanel.tsx`, `src/components/chat/ChatComparisonPanel.tsx` — all wired with `remarkPlugins={[remarkGfm]}`.
