## Understanding the reference image

The screenshot shows a compact "Property analysis" detail card with:
- Property title (blue address) + meta line: city, beds · baths · sqft
- Tab bar: Overview · Details · Neighborhood · Market · Notes
- Two-column body:
  - Left: tinted "AI Summary" panel + "Key Highlights" checklist with green check icons
  - Right: "Match Score" card with a large green circular gauge + label, and "Score breakdown" with horizontal green bar meters (Price, Location, Property, Neighborhood, Lifestyle)
- Rounded cards, hairline borders, generous whitespace, white bg, blue accent

## Design plan (adapted, not copied)

Redesign the "View Full Analysis" experience on `/saved-analyses` to match this editorial detail-card language, while keeping the list page and existing data model intact. Every tab must surface real saved data — including the full chat analysis text.

### List page (`SavedAnalyses.tsx`)
Keep current grid + filters. Small visual polish only:
- Address rendered in primary/blue link style with subtle meta line (source · saved date · beds/baths/sqft when available from `key_metrics`)
- Primary card action becomes "Open analysis" → opens the redesigned detail view

### Detail view (the "attached image" layout)
Convert the current view Dialog into a wider, tabbed layout:

```text
┌───────────────────────────────────────────────┐
│ Property analysis                             │
│ 123 Maple Street  (blue)                      │
│ City, ST ZIP · 3 bd · 2.5 ba · 1,600 sqft     │
│ [Overview] Analysis  Details  Neighborhood    │
│           Market  Notes                       │
├─────────────────────────────┬─────────────────┤
│ AI Summary (tinted)         │ Match Score     │
│ short synopsis              │  ◯ 86  Great    │
│                             │       match     │
│ Key Highlights              ├─────────────────┤
│ ✓ Within budget             │ Score breakdown │
│ ✓ Great neighborhood        │ Price     ▬ 90  │
│ ✓ Meets your must-haves     │ Location  ▬ 85  │
│ ✓ Short commute             │ Property  ▬ 88  │
│                             │ Neighbrhd ▬ 80  │
│                             │ Lifestyle ▬ 85  │
└─────────────────────────────┴─────────────────┘
```

Tabs (all sourced from existing data — no new fields):
- **Overview**: short AI Summary (first paragraph of `analysis_summary`) + Key Highlights + Match Score + Score breakdown
- **Analysis**: the **full chat analysis** rendered as markdown (the complete `analysis_summary` the AI produced, using the same `chatMarkdownComponents` + `remark-gfm` renderer used elsewhere) so the user can read the entire chat output the way it was generated. Includes source badge (App / Extension), saved date, and property URL button.
- **Details**: property meta from `key_metrics` (price, beds, baths, sqft, year built, property type, price/sqft) as a compact key-value grid
- **Neighborhood**: any neighborhood/schools/crime/walk fields in `key_metrics`; graceful "Not captured" empty state
- **Market**: cap rate, cash-on-cash, DSCR, rent estimate, appreciation, net cash flow as small stat tiles
- **Notes**: existing editable note textarea + save state

### Data mapping (no schema changes)
- `investment_score` → circular gauge (0–100), reuse `ScoreCircle` at larger size
- `score_label` → "Great match" style label; fall back to threshold labels (≥80 Great, ≥50 Solid, <50 Weak)
- Score breakdown bars: read optional `key_metrics.breakdown` (`{price, location, property, neighborhood, lifestyle}` 0–100). If absent, render a single "Overall" bar equal to `investment_score` — never fabricate dimension values.
- Key Highlights: read `key_metrics.highlights` (string array). If absent, derive up to 4 bullets from data we already have (e.g., "Within budget", "Positive cash flow" when `netCashFlow > 0`, etc.). No AI calls.
- Analysis tab body: `analysis_summary` rendered with existing markdown pipeline.

### Styling
- Reuse tokens; blue link = `text-primary`; check icons = `text-[hsl(var(--chart-2))]`; AI Summary panel = `bg-primary/5 border border-primary/10`
- Rounded-xl cards, hairline borders (`--brief-hairline`), full dark-mode support
- Detail view stays inside the Dialog, expanded to `max-w-4xl`

### Files to change
- `src/pages/SavedAnalyses.tsx` — new tabbed detail layout + minor list-card tweaks
- (Optional) extract `src/components/savedAnalyses/AnalysisDetail.tsx` to keep the file tidy

### Non-goals
- No changes to `save-analysis` edge function, `useSavedAnalyses` hook, or DB schema
- No changes to save flow from chat / extension
- No changes to premium gating

## What it will look like
Calm editorial two-column analysis card: tabs at the top, tinted AI summary + green-check highlights on the left, prominent green match gauge and dimension bars on the right. A dedicated **Analysis** tab shows the full chat analysis markdown so the user can read the AI's complete response, exactly as it was generated.
