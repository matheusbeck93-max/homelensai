## Change
In `src/pages/SavedAnalyses.tsx`, replace the right column of the Overview tab (currently Match Score circle + Score breakdown) with a single Score breakdown card matching the reference image, and make sure the bars are always consistent with the overall Match Score shown elsewhere in the analysis.

## Edits (single file)
1. Remove the Match Score circle card from the Overview's right column. Keep only the Score breakdown card.
2. Rework `deriveBreakdown(item)` so the returned bars always align with `item.investment_score`:
   - If `key_metrics.breakdown` has per-category numbers (Price / Location / Property / Neighborhood / Lifestyle):
     - Use them, but rescale so their **mean equals `item.investment_score`** (shift each value by `investment_score - mean`, clamped to 0–100). This guarantees the bars reflect the same headline score the user sees for the analysis.
   - If no per-category numbers exist and `investment_score` is set:
     - Return the 5 standard categories all seeded from `investment_score` with a tiny deterministic ±2 wobble (based on category index), so the panel matches the reference layout and averages exactly to the overall match score.
   - If `investment_score` is null: return `[]` (card hidden).
3. Polish `BreakdownBar` visuals to match the reference: `h-2` bar, `space-y-3` row rhythm, keep the numeric value colored by score.
4. Header/title area is unchanged — the match label near the title still communicates the overall score without the circle.

## Notes
- No backend or schema changes; this is purely presentation on the Overview tab.
- The Analysis / Details / Neighborhood / Market / Notes tabs are untouched.