## Apply marker sanitization to the Saved Analyses list cards

The detail view already strips `**` and `[n]` markers, but the list card (`AnalysisCard` in `src/pages/SavedAnalyses.tsx`) still shows the raw values. Screenshot confirms the title renders as `** 2148 Cedar Tree Ln, Wa…` and the preview text renders as `**Verdict:** **Borderline yes** —`.

### Change
In `src/pages/SavedAnalyses.tsx`, inside `AnalysisCard`:
- Wrap `item.property_address` (line 262) with `stripMarkers(...)`.
- Compute `summary` via `sanitizeSummary(item.analysis_summary)` before deriving `summaryShort` (lines 244–246), so the 3-line preview no longer shows `**` / `[1]` markers.

No other files change. Detail view already handles this; this only fixes the card list shown at `/saved-analyses`.