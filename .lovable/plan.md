## Goal
Redesign the site footer to match the attached dark, multi-column layout, and mount it on all new marketing pages (Features, individual Feature pages, Solutions, Buyer/Investor plans, Pricing, FAQ).

## New footer design (matching reference)
- Full-width dark band (`bg-[hsl(var(--foreground))]` or `bg-slate-950` mapped to a token) with light text, replacing today's muted/light footer.
- Layout: left brand column (HomeLens logo + one-line tagline), then 4 link columns on the right. On mobile, stacks vertically.
- Columns (using items HomeLens already has):
  1. **Product** — Features, Solutions, Pricing, Chrome Extension, Investor Brief
  2. **Company** — About / Blog, FAQ, Support (mailto)
  3. **Resources** — Buyer Plan, Investor Plan, Calculators, Open Houses
  4. **Legal** — Terms of Service, Privacy Policy, Cookie Policy, Fair Housing, Accessibility, CCPA, DMCA, Do Not Sell
- Divider line, then bottom bar: left = small "Security" badge chip (links to a Security summary — reuse existing Privacy/Trust copy target; if none, link to Privacy Policy) + social icons placeholder area (skip if no handles), right = copyright `© {year} Homelens.ai LLC` and address line if provided.
- Uses existing semantic tokens only (no hardcoded hex beyond token mapping); icons via `lucide-react` kept minimal (no per-link icon chips like the old design).

## Files to change
- `src/components/Footer.tsx` — rewrite to the new multi-column dark layout described above. Keep the existing export name so all current importers pick up the redesign automatically (Index, Blog, BlogPost, OpenHouses, Usage, BlogAdmin, BlogEditor).
- Add `<Footer />` to new marketing pages that currently lack it:
  - `src/pages/marketing/FeaturePage.tsx`
  - `src/pages/marketing/SolutionPage.tsx`
  - `src/pages/marketing/Faq.tsx`
  - `src/pages/Pricing.tsx` (verify; add if missing)
- No route, data, or business-logic changes.

## Out of scope
- No changes to authenticated app pages' footers beyond the shared component redesign.
- No new "Security" page creation — the Security link points to the existing Privacy Policy unless you'd like a dedicated page (say the word and I'll add `/security`).
