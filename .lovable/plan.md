## Problem
The score breakdown bars reference undefined CSS tokens (`--chart-2`, `--chart-4`) in `src/pages/SavedAnalyses.tsx`. Because those variables don't exist in `src/index.css`, `hsl(var(--chart-2))` resolves to an invalid color and the bar fill/percentage text render with no visible color.

## Fix
In `src/pages/SavedAnalyses.tsx`:

1. `BreakdownBar` (line ~112-131): replace the color logic with real HSL values that work in both light and dark mode:
   - `value >= 50` → green (e.g. `hsl(142 71% 42%)`)
   - `value < 50` → red (e.g. `hsl(0 74% 52%)`)
   Apply the same color to the bar fill and the numeric label on the right.

2. Overall score display in the breakdown card header (added last turn, ~line 50 helper): replace the same `--chart-2` / `--chart-4` references with the green/red HSL values, plus a neutral fallback when the score is null, so the headline overall score is colored consistently with the bars.

No other files change; the logic that normalizes category bars to match the overall investment score stays as-is.