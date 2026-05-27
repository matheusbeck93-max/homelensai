## Goal

Complete the source-attribution + freshness work started earlier. Wrap the remaining real Brief cards with `MetricWithSource`, surface an "Estimate" badge where applicable, and finish the Market Comparator provenance UI.

## Scope

Frontend/presentation only. No edge function, schema, or business logic changes.

### 1. Brief cards — wire `MetricWithSource` / `CardSourceFooter`

- `RankedListCard.tsx` — append `CardSourceFooter` using `card.sources` (saved_properties / saved_analyses). Update `BriefCardRenderer` to pass `sources` through.
- `MissingDataCard.tsx` — same: `CardSourceFooter` keyed to `saved_analyses`.
- `BudgetAffordabilityCard.tsx` — wrap each market's median value with `MetricWithSource` using a `heuristic_estimate` source ("Internal heuristic — pending market_stats wiring"). Add footer.
- `TrendChartCard.tsx` — show a small caption under the chart: "Estimate · Internal heuristic" via `CardSourceFooter` (no per-point tooltip).
- `BriefCardRenderer.tsx` — pass `sources` to the four cards above (already done for portfolio cards).

### 2. Estimate badge on `InsightCard`

- Read `card.isEstimate` in `BriefCardRenderer` and pass to `InsightCard` as a new optional `isEstimate` prop.
- `InsightCard.tsx` — render a small muted "Estimate" pill in the header when true. Token-based styling only.

### 3. Brief-level last-refreshed footer

- `BriefCard.tsx` — under the existing generated-on timestamp, add "Last refreshed <relative time>" using `relativeAsOf()` (already present absolute date stays).

### 4. Market Comparator finalization

In `src/components/investor/MarketComparator.tsx`:
- Column header `(i)` popovers describing each metric + listing allowed source domains (reuse the existing `WHITELIST_DOMAINS` literal — duplicate the small array client-side; no edge changes).
- For any cell rendered as `"n/a"`, attach a popover: "No source available for this market in the comparator window."
- Render `result.dataNotes` (when present) as a "Data notes" footer block under the table.
- Show the `generatedAt` timestamp under the verdict cards as "Generated on submit · <relative time>".

## Files

Edit:
- `src/components/investor/brief/BriefCardRenderer.tsx`
- `src/components/investor/brief/InsightCard.tsx`
- `src/components/investor/brief/BriefCard.tsx`
- `src/components/investor/brief/cards/RankedListCard.tsx`
- `src/components/investor/brief/cards/MissingDataCard.tsx`
- `src/components/investor/brief/cards/BudgetAffordabilityCard.tsx`
- `src/components/investor/brief/cards/TrendChartCard.tsx`
- `src/components/investor/MarketComparator.tsx`

No new files. No DB/edge changes.

## Out of scope

My Properties, Investor Calculator, scheduled refresh, realtime — per earlier scope decision.
