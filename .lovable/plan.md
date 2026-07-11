
# Investor Brief — Premium Editorial Redesign

Restyle `/investor` to match the reference layout while keeping the HomeLens steel-blue palette and current Outfit/Figtree sans typography. Structural changes only to the brief page; no backend, RLS, or data changes.

## Layout (matches reference)

```text
┌─────────────────────────────────────────────────────────────────┐
│  Investor Brief                       🏠 Prepared by Homelens   │
│  Today's grounded read...             🕐 Jul 11  [date range ▾] │
├──────────────┬──────────────────────────────────────────────────┤
│  Concierge   │  Portfolio Snapshot     │  Portfolio Alerts      │
│  card        ├─────────────────────────┼────────────────────────┤
│  + narration │  Watchlist summary      │  Top scored analyses   │
│  + Ask input │           [ Deep Dive ]                          │
│              ├─────────────────────────┼────────────────────────┤
│              │  Watchlist (5)          │  Analyses Status       │
└──────────────┴─────────────────────────┴────────────────────────┘
```

- Left column (`~360px`): "Your Portfolio Concierge" card with masthead icon, last-refreshed line, "Tuned for: … change" chip, narration text (current `effectiveIntro` + insights condensed), and the Ask Homelens prompt input pinned at the bottom.
- Right area: 2-column grid of insight cards. Center "Deep Dive" pill sits between rows as a full-width divider CTA (opens existing `DeepPanel`).
- Top-right masthead: "Prepared by Homelens" with home icon + today's date + date-range picker (visual only in v1, wired to existing `regenerate`).

## Premium touches

- Warm off-white canvas: introduce `--brief-canvas` (ivory tuned from HomeLens neutrals) applied only to the Investor Brief page container — global theme untouched.
- Cards: larger radius (`rounded-2xl`), hairline borders (`border-border/60`), soft elevation (`shadow-[0_1px_2px_rgba(44,62,85,0.04),0_8px_24px_-12px_rgba(44,62,85,0.10)]`), generous internal padding.
- Micro-animations: staggered `animate-fade-in` on card mount (60ms increments), `hover-scale`-lite on interactive cards, subtle lift on hover.
- Editorial masthead row, refined section labels (uppercase tracking-wide muted), thin dividers, restrained iconography.
- High-Value Alert keeps warm amber accent but re-tuned to HomeLens tokens (no raw hex).

## Files to change

- `src/pages/InvestorBrief.tsx` — new 3-zone grid (`lg:grid-cols-[360px_1fr]` with inner 2-col right side), masthead header, Deep Dive divider button, canvas class, stagger wrapper.
- `src/components/investor/brief/BriefCard.tsx` — restyle as "Portfolio Concierge": add masthead row (icon + title + Refresh), "Tuned for" chip, keep narration/insights, embed Ask Homelens prompt input at the bottom (wire to existing chat entry — reuse `enterChatModeFromCard` with a generic ask, or navigate to `/chats` if simpler; confirmed: use existing DeepPanel entry to stay on-page).
- `src/components/investor/brief/BriefCardRenderer.tsx` + `InsightCard.tsx` — apply premium card shell (radius, border, shadow, padding). No data changes.
- `src/index.css` — add scoped tokens: `--brief-canvas`, `--brief-card`, `--brief-shadow-soft` under a `.brief-surface` selector; no changes to global theme tokens.
- `tailwind.config.ts` — optional `boxShadow.brief` utility referencing the new token.

## Out of scope

- No changes to card data, edge functions, subscription gating, or `DeepPanel` behavior.
- Date-range picker is visual-only in v1 (renders today's date; hooking it to filtering is a follow-up).
- No changes to other pages or global colors/fonts.

## Verification

- Typecheck/build green.
- Playwright screenshot of `/investor` at 1280×1800 to confirm 3-zone layout, masthead, Deep Dive divider, and card polish.
- Dark mode spot check (tokens keep contrast).
