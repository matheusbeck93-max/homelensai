## Problem
The Saved Analyses detail header shows raw markdown/citation artifacts (`** 2148 Cedar Tree Ln, Waldorf, MD 20601[1]`, `Built ** 4 beds ... built 1997[1]`) because `property_address` and the fields inside `key_metrics` (beds/baths/sqft/yearBuilt) come from the AI and are rendered as plain text with no sanitization. `sanitizeSummary` only runs on the summary/analysis markdown.

## Fix
In `src/pages/SavedAnalyses.tsx`:

1. Add a small `stripMarkers(text)` helper that removes bold/italic markdown markers (`**`, `__`, stray `*` around words) and Perplexity-style citation tokens (`[1]`, `[¹]`, `[^1]`, and `[n](url)` links), then collapses extra whitespace.
2. Extend `sanitizeSummary` to also call `stripMarkers` at the end so bold markers in the summary are removed too (kept as plain text — no bolding).
3. Apply `stripMarkers` when rendering the header title (`property_address || property_url`) and each `metaLine` entry (`beds`, `baths`, `sqft`, `yearBuilt`). Also apply it to the details tab table cells that render the same `km.*` values, and to `deriveHighlights` output, so the same artifacts don't appear on other tabs.

No backend or data changes — sanitation is presentation-only.