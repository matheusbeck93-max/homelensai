
## Goal

For `/investor` (Investor Brief) and the Market Comparator:
1. Make sure every visible number is either backed by a real, current source — or is clearly labeled as an estimate.
2. Expose data provenance via an info tooltip (i) on each metric, showing source + "as of" timestamp, plus a manual refresh control where applicable.

## Audit findings (from current code)

`src/lib/investorBrief/insightRegistry.ts` reveals that several brief cards currently render **synthesized / placeholder** numbers:

| Card | Status today | Notes |
|------|--------------|-------|
| `setup`, `sample` | OK | Cold-start helpers, no metric claims. |
| `watchlist_price_trend` | Real (saved_properties count + cities). | |
| `ranked_analyses` | Real (saved_analyses scores). | |
| `missing_data` | Real (key_metrics nullness). | |
| `portfolio_glance` | Real (investor_owned_properties + amortized balance). | |
| `portfolio_alerts` | Real (investor_owned_property_alerts). | |
| `budget_vs_market` | **Synthetic** medians from `max_price_range * 0.55..` heuristic. | |
| `cap_rate_trend` | **Synthetic** 12-mo series (`base + sin drift`). | |
| `price_reduction_heatmap` | **Synthetic** ZIP intensities. | |
| `neighborhood_scores` | **Synthetic** school/crime/walk scores. | |
| `flip_spread_movers` | **Hardcoded** addresses & ARV. | |
| `migration_trends` | **Synthetic** net migration. | |

Market Comparator (`market-comparator` edge function) does call an AI/research backend, but the UI does not surface which sources informed any row, and "n/a" cells aren't explained.

Brief data is cached in `investor_briefs` and only updates on manual refresh — that's consistent with the chosen "Show freshness + manual refresh" behavior, so no scheduler work is needed.

## Plan

### 1. Truthful labeling for synthetic cards (no fabrication)

For every card whose data is not yet wired to a real source, do one of:

- **Hide the card** when no real source is available (preferred for `flip_spread_movers`, `price_reduction_heatmap`, `migration_trends`, `neighborhood_scores`) — flip `isEligible` to require a feature flag/real-source presence so users stop seeing fake numbers.
- **Mark as estimate** for `budget_vs_market` and `cap_rate_trend` until backed by `market_stats` / `market_snapshots`: render with a visible "Estimate" badge and the tooltip source set to `"Internal heuristic — pending market_stats wiring"`. Also drop priority so they sink below real cards.

### 2. Source attribution model

Add a small typed contract used by every card:

```ts
// src/lib/investorBrief/sources.ts
export type SourceKind = 'user_input' | 'derived' | 'rentcast' | 'zillow'
  | 'market_stats' | 'market_snapshots' | 'saved_properties'
  | 'saved_analyses' | 'owned_properties' | 'owned_alerts'
  | 'ai_research' | 'heuristic_estimate';

export interface MetricSource {
  label: string;          // e.g. "RentCast AVM"
  kind: SourceKind;
  asOf?: string | null;   // ISO timestamp
  note?: string;          // optional caveat
}
```

Extend `ComposedCard` (in `src/lib/investorBrief/types.ts`) with an optional `sources?: Record<string, MetricSource>` keyed by metric id (e.g. `totalValue`, `totalEquity`). The composer / `loadData` fills it from the real fetched rows (e.g. `current_value_refreshed_at`, `current_value_source` from `investor_owned_properties`).

### 3. Reusable `MetricWithSource` UI

New component `src/components/investor/brief/MetricWithSource.tsx`:

- Renders the value + a small `(i)` icon button (≥24×24 touch target).
- On hover/tap, a `Tooltip`/`Popover` shows: source label, "as of <relative time>", optional note, and — when the source supports it — a "Refresh" button.
- Reuses tokens from the design system only.

Update the existing card components to wrap each rendered number with `<MetricWithSource metric="totalValue" sources={card.sources} value={fmt(data.totalValue)} />`:

- `PortfolioGlanceCard.tsx` — sources: `current_value_estimate` (RentCast or manual), amortized loan balance (derived from user inputs), purchase price (user input).
- `PortfolioAlertsCard.tsx` — source: `owned_alerts` with `surfaced_at`.
- `RankedListCard.tsx` (for `watchlist_price_trend`, `ranked_analyses`) — source: `saved_properties` / `saved_analyses` with `created_at`.
- `MissingDataCard.tsx` — source: `saved_analyses.key_metrics`.
- `BudgetAffordabilityCard.tsx` — source: `heuristic_estimate` with note.
- `TrendChartCard.tsx` (for `cap_rate_trend`) — source: `heuristic_estimate` with note.

The Investor Brief intro (top-left card) already shows "Generated <date>" + a refresh button — leave that intact; it serves as the brief-level freshness indicator.

### 4. Market Comparator attribution

In `src/components/investor/MarketComparator.tsx`:

- Add a `(i)` next to each table column header explaining the metric and listing the allowed source domains (already declared as `WHITELIST_DOMAINS` in the edge function — surface them).
- Render `result.dataNotes` (currently mostly unused in the truncated section) as a "Data notes" footer under the table.
- For any cell rendered as `"n/a"`, show the tooltip text "No source available for this market in the comparator window."

No edge-function changes; the function already returns `dataNotes` and `normalizedLabels` — we just need to display them with provenance.

### 5. Stale-state UX (manual refresh only, per your choice)

- Brief: keep existing `regenerate()` button on `BriefCard`. Add small "Last refreshed: <relative time> · Refresh" footer.
- Owned-property valuations underpin `portfolio_glance`. Show "Valuations from RentCast, refreshed <relative>" in the card tooltip. A per-property refresh already exists in `property-valuation` edge function — not invoked from the brief (avoid 50× API calls); link users to My Properties for forced refresh.
- Market Comparator: results are per-submission, so freshness = "Generated on submit". Show that timestamp under the verdict cards.

## Technical details

Files to add:
- `src/lib/investorBrief/sources.ts` — types + helpers (`relativeAsOf()`).
- `src/components/investor/brief/MetricWithSource.tsx` — tooltip/popover wrapper.

Files to edit:
- `src/lib/investorBrief/types.ts` — extend `ComposedCard` with `sources?`.
- `src/lib/investorBrief/insightRegistry.ts`:
  - Demote/hide synthetic cards as described.
  - Populate `sources` for real cards (using `current_value_refreshed_at`, `current_value_source`, alert `surfaced_at`, etc.).
- `src/lib/investorBrief/briefComposer.ts` — pass `sources` through `ComposedCard`.
- `src/components/investor/brief/cards/*` — wrap metrics with `MetricWithSource`.
- `src/components/investor/brief/BriefCard.tsx` — add last-refreshed footer + relative time.
- `src/components/investor/MarketComparator.tsx` — column tooltips, `dataNotes` footer, `n/a` tooltips, "Generated on submit" stamp.

Out of scope (per your scope choice): My Properties / Owned Property Detail, Investor Calculator. Out of scope (per your freshness choice): scheduled jobs, realtime subscriptions.

## Risk notes

- Hiding synthetic cards will reduce the number of cards shown for users with no owned properties / saved analyses; the Investor Brief may look emptier until real data sources are wired. This is the honest tradeoff requested ("data is correct").
- No DB migrations needed.
