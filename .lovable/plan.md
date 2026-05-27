## HomeLens — Investor "My Properties" (Portfolio Mode)

Large multi-phase build. Recommend shipping in the order below; each phase is independently usable. I'll confirm before starting each phase.

### Phase 1 — Data spine (DB + storage)
- Migration: `investor_owned_properties` + child tables (photos, rental, valuations, improvements, events, alerts, documents) with RLS + GRANTs.
- Add `property_id` + `scope` to `investor_console_threads`.
- Storage buckets: `owned-property-photos` (public-read), `owned-property-documents` (private), with per-user path RLS.

### Phase 2 — My Properties UI shell
- New rail item between Brief and Saved Analyses (building icon + count badge).
- `MyPropertiesPanel` route at `/investor/properties`.
- `PortfolioRollup` (4 stat cards + concentration flag).
- `OwnedPropertyCard` grid + filter/sort pills.
- `AddPropertyDialog` 5-step wizard (only Identity + Acquisition required).

### Phase 3 — Property detail + metrics
- `OwnedPropertyDetail` two-column layout (chat left, tabbed deep panel right).
- Tabs: Overview, Acquisition+Loan, Rental, Improvements, Events, Documents.
- `computeMetrics.ts`: equity, cash flow, cap rate, IRR, returns decomposition, amortized loan balance. Shared with `calcEngine.ts`.
- `EditValuationDialog` with manual override + expiry + audit row.

### Phase 4 — Valuation pipeline
- Edge fn `property-valuation` (on-demand, rate-limited 1/hr/property).
- Edge fn `property-valuation-refresh` (daily cron, all active properties).
- Provider adapter: **RentCast** (sale + rent in one call). Requires `RENTCAST_API_KEY` — already present in secrets.
- Loan balance recompute in same job.

### Phase 5 — Alerts engine
- `alertsEngine.ts` with 7 alert types: refi_opportunity, heloc_eligible, rent_below_market, insurance_renewal, sell_vs_hold, tax_basis_event, appraisal_due.
- Edge fn `property-alerts-eval` (daily cron + on user edits).
- Dedup by `(property_id, alert_type, status=active)`. 30-day re-surface after dismiss.
- `AlertCard` with "Run the analysis" CTA → opens chat with relevant tool pre-called.

### Phase 6 — AI tools (12 new)
Registered in existing `toolRegistry.ts`:
`list_owned_properties`, `get_property_state`, `estimate_property_value`, `compute_property_returns`, `compute_property_equity`, `analyze_refi`, `compute_heloc_borrowable`, `compare_rent_to_market`, `project_property_value`, `suggest_sell_vs_hold`, `compute_capital_gains_if_sold`, `list_active_alerts`.
Plus visuals (OwnedPropertiesTable, RefiScenarioTable, HelocCard, etc.) wired into `visualRegistry.tsx`.

### Phase 7 — Brief integration + persona
- New brief cards: `portfolio_glance`, `portfolio_alerts` (eligible only when ≥1 owned).
- Subscribe `InvestorBriefContext` to `investor_owned_properties` realtime; expose `ownedProperties`, `portfolioRollup`, `activeAlerts`.
- New persona `existing_owner` in `personaRegistry.ts` with toolWeights + card weights + starter prompts.
- Auto-suggest persona on first-property-add (Mixed users only).

### Phase 8 — Per-property chat + documents + tax export
- Per-property thread (scope='property', property_id pinned as context card).
- Drag-drop document upload with category, signed-URL download.
- `scheduleE.ts` → CSV export per tax year.
- Telemetry events.

---

### Open product decisions (confirm before I start)

1. **Valuation provider:** proceed with **RentCast** (key already configured)? Cost ~$0.10/property/month.
2. **Phase ordering:** ship Phase 1→8 sequentially, or do you want me to start with a thinner v1 (Phases 1–3 only, no auto-valuation/alerts/AI tools yet) to validate the UX first?
3. **Rail order:** Home → **My Properties** → Saved Analyses → Saved Searches → Calculator → Preferences — confirm?
4. **Auto-refresh default:** daily for premium / weekly for free — OK, or all daily for v1?

### Scope notes
- Will not touch: tenant mgmt, climate risk, 1031 flow, partnership splits, cost-seg depreciation, mobile photo capture — all explicitly out of scope per the prompt.
- Prospecting surface stays untouched when user has zero properties.

**Recommendation:** Start with **Phase 1 (DB migration)** so the schema is locked in, then ship Phases 2–3 (UI shell + detail + manual valuations) as a usable v0 within one or two iterations. Auto-valuation/alerts/AI tools follow once the data layer is proven.

Reply with answers to the 4 questions above and I'll start with the Phase 1 migration.
