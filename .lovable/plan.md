## Change
In `src/pages/SavedAnalyses.tsx`, restore the overall Match Score display on the Overview tab's Score breakdown card, and simplify the bar coloring to a binary positive (green) / negative (red) scheme.

## Edits (single file: `src/pages/SavedAnalyses.tsx`)

1. **Show the overall Match Score inside the "Score breakdown" card header.**
   - Replace the plain `"Score breakdown"` label with a header row containing:
     - Left: title `"Score breakdown"` + small subtitle with the match label (e.g., "Great match" / "Solid match" / "Weak match") from `scoreMatchLabel(item.investment_score)`.
     - Right: the overall score rendered large (e.g., `text-3xl font-semibold`) as `{investment_score}/100`, colored green/red using the same positive/negative rule below.
   - If `investment_score` is null, hide the score number and just show the title.

2. **Recolor `BreakdownBar` to green (positive) / red (negative).**
   - Positive threshold: `value >= 50` → green (`hsl(var(--chart-2))` or existing success token).
   - Negative: `value < 50` → red (`hsl(var(--destructive))`).
   - Apply this color to both the filled bar segment and the numeric value on the right. Drop the previous 3-tier `scoreColor` usage inside this component only (leave `scoreColor` intact elsewhere).

3. No changes to `deriveBreakdown`, other tabs, or any data logic.

## Technical notes
- Uses existing design tokens (`--chart-2` for green, `--destructive` for red) — no hardcoded hex.
- Purely presentation; no backend/schema changes.
