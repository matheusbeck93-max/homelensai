---
name: Excel workflow generation rules
description: When and how the chat may generate the workflow_excel uiBlock — strictly opt-in (offer-and-accept or explicit request).
type: feature
---

# Excel workflow generation

The chat agent generates a `workflow_excel` uiBlock ONLY in two cases:

1. **Explicit request:** the user's CURRENT message asks for an Excel/spreadsheet/.xlsx/download (regex: `excel|spreadsheet|planilha|xlsx|workbook|export to excel|download…`).
2. **Accepted offer:** the previous assistant message offered the spreadsheet (line ends with "Want me to put this into a downloadable Excel spreadsheet?" or `…spreadsheet?`/`…planilha?`) AND the user replies affirmatively (`yes`, `sure`, `please`, `go ahead`, `send it`, `sim`, `pode`, `envie`, …).

## Default behavior (no Excel)

- Calculations are presented inside the chat using the **NUMERIC SUMMARY FORMAT** (markdown table). Never replace the in-message table with a workbook.
- For scenario topics (`buying power`, `affordability`, `mortgage`, `monthly payment`, `ROI`, `cash flow`, `renovation`, `down payment`, `closing cost`, `cost breakdown`, `budget`, etc.), the frontend appends a single offer line at the end:
  > Want me to put this into a downloadable Excel spreadsheet?
- The workbook is NOT attached in the same turn as the offer.

## Frontend gating (`src/pages/Chats.tsx`)

- `isExplicitExcelRequest(text)` — explicit keywords for Excel/download.
- `shouldOfferExcel(text)` — calculation/scenario keywords; only authorizes the offer line, never the workbook.
- `isAffirmativeReply(text)` — short affirmative response (must be combined with a previous offer).
- The legacy `isWorkflowRequest` keyword auto-trigger has been removed. Keyword presence (afford/mortgage/buying power/etc.) does NOT generate Excel.

## Workbook content (when allowed)

- Every cost/value cell must contain a realistic numeric estimate (no empty/placeholder cells).
- Use raw numbers for monetary values; percentages as `"6.50%"` strings.
- Multiple sheets when applicable, plus a Summary sheet with grand totals.