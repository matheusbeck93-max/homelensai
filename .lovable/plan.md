## Problem

On mobile and tablet, the hamburger drawer (shown to logged-out visitors on the homepage and every other public page) renders the full flat list of every Feature and every Solution stacked vertically. The result is a long, cluttered scroll that looks bad on small screens.

## Reference

The two Turing screenshots show the target pattern: top-level sections ("Train AI", "Build AI", "Hire AI Talent", "Research") that collapse by default; tapping one expands to reveal the grouped children. That collapsible pattern is what we'll adopt — not the Turing visual design, colors, or typography.

## Change

Only touch `src/components/marketing/PublicNav.tsx` — specifically the `PublicNavMobile` component used inside the existing mobile Sheet in `src/components/Navigation.tsx`. Because `PublicNavMobile` is already the single source for the logged-out drawer, updating it automatically fixes every public page (Home, Features, Solutions, Pricing, FAQ, marketing sub-pages, Auth, etc.).

New structure inside the drawer:

```text
Features          v     (tap to expand → list of feature items with icon + short)
Solutions         v     (tap to expand → list of solution items with icon + short)
Pricing                 (direct link)
FAQ                     (direct link)
```

- Use the existing shadcn `Accordion` primitive (`@/components/ui/accordion`, type="single", collapsible) so styling matches the rest of the app — no new colors, fonts, or tokens introduced.
- Both accordion sections start collapsed so the drawer opens short and clean.
- Each expanded row keeps the current icon + name + short-description treatment (unchanged visual language), just nested under the accordion.
- Pricing and FAQ remain flat rows below the accordion (they have no children).
- Tapping any leaf still calls `onNavigate?.()` then `navigate(path)`, preserving the drawer-close behavior.
- No changes to desktop `PublicNav`, no changes to the authenticated `navItems`, no changes to `Navigation.tsx` breakpoints, no design-token or Tailwind config edits.

## Verification

- Run the app, sign out, resize to mobile (375px) and tablet (768–1023px). Open the hamburger on `/`, `/pricing`, `/faq`, `/features/*`, `/solutions/*`. Confirm the drawer opens with two collapsed sections plus Pricing/FAQ, expands on tap, and navigates correctly.
- Confirm the authenticated drawer (logged-in `navItems`) is unchanged.
