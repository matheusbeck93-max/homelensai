## Redesign the Investor Brief to match the reference

Keep every existing topic and data source. This is a visual/layout refresh only — no changes to `useInvestorBrief`, card data hooks, or `BriefCardRenderer` logic beyond adding a new visual chrome.

### 1. Page background & masthead — `src/pages/InvestorBrief.tsx`
- Use the standard site background (`bg-background`), same as other pages. Remove any warm-paper tint. Dark mode inherits from the app tokens automatically.
- Keep the "Prepared by Homelens" masthead + date range and the chat/BriefCard column intact.
- Update the header copy to match the reference tone: title "Your Investor Brief", subtitle "A snapshot of your analysis activity and top opportunities this week."

### 2. New KPI row at the top (4 cards, colored top accent)
Add a `BriefKpiRow` component rendered above the existing 2-column grid. Four tiles matching the reference:
- Analyses this month (from `useSavedAnalyses` count within current month) — blue accent, chart icon
- Avg investment score (average of saved score, 0–100) — green accent, target icon
- Markets compared (distinct cities from saved analyses) — purple accent, buildings icon
- Top score found (max score + top address/price) — amber accent, bolt icon

Each tile: white card, 1px hairline border, thin 2px colored bar on top, uppercase eyebrow label, large number, one line of context, small trend/status line. Uses semantic tokens so dark mode works.

If any metric can't be computed (no saved analyses yet), the tile shows a muted "—" and a "Save your first analysis" hint. No new backend calls.

### 3. Restyle existing brief cards with the same chrome
Update `InsightCard` (`src/components/investor/brief/InsightCard.tsx`):
- Replace the current `brief-card` class with a shared `.dash-card` style: white/`bg-card` surface, `border border-border`, `rounded-xl`, subtle shadow, hover lift.
- Add an optional 2px top accent bar whose color is derived from card category:
  - trends / portfolio_glance → blue
  - ranked_list / flip_spread_movers / migration_trends → purple
  - anomaly / portfolio_alerts / missing_data → amber
  - neighborhood_scores / budget_affordability / setup / sample → green
- Keep header, body slot, and existing footer (Deep Dive + View Sources + overflow menu) — no logic changes.

### 4. Left column — keep the Chat/Brief card, restyle only
- `BriefCard` stays as the left rail (intro, insights list, follow-ups, refresh). Wrap it in the same `.dash-card` chrome so it visually matches the reference's right-side rail.

### 5. CSS cleanup — `src/index.css`
- Remove the `.brief-surface` scoped block (no longer used).
- Remove `.brief-card` custom rules; replace with a single `.dash-card` utility inside `@layer components` using only global tokens (`--card`, `--border`, `--foreground`, `--muted-foreground`). No `--brief-*` variables needed.
- Keep `.brief-stagger` and `brief-fade` keyframes for the load-in micro-animation.

### 6. Grid layout
```text
┌──────────────────────────────────────────────────────────┐
│  KPI 1   │   KPI 2   │   KPI 3   │   KPI 4              │  ← new row
├────────────────────────────┬─────────────────────────────┤
│                            │                             │
│   Insight cards grid       │   Chat / BriefCard rail     │
│   (2 cols on lg)           │   (sticky top on lg)        │
│                            │                             │
└────────────────────────────┴─────────────────────────────┘
```
Reference puts the list on the left and quick-actions rail on the right; we mirror that. On mobile everything stacks.

### Technical notes
- New files: `src/components/investor/brief/BriefKpiRow.tsx`, `src/components/investor/brief/BriefKpiTile.tsx`.
- Edited: `InvestorBrief.tsx`, `InsightCard.tsx`, `index.css`.
- No changes to data hooks, edge functions, DB schema, or `BriefCardRenderer` switch.
- All colors via semantic tokens; accent bars use `bg-primary`, `bg-emerald-500`, `bg-violet-500`, `bg-amber-500` (Tailwind palette utilities, allowed for functional accent stripes not tied to theming).

### Out of scope
- No changes to the actual card data, scoring, or content of the topics.
- No changes to Deep Dive behavior, tool footer, or dropdown menu.
- No My Properties changes.
