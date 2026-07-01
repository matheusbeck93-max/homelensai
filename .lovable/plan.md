## Goal
Reduce the excessive whitespace between the navigation bar and the hero content on all Feature pages (`/features/*`) and both Solution pages (`/solutions/buyer`, `/solutions/investor`). Homepage stays untouched.

## Change

In `src/pages/marketing/FeaturePage.tsx` and `src/pages/marketing/SolutionPage.tsx`, update the hero `<section>`'s container padding from the current oversized top padding to a tight value (~40–60px below the navbar).

Currently on `FeaturePage.tsx`:
```
<div className="container relative mx-auto px-4 pb-16 pt-24 md:pb-24 md:pt-32">
```

New:
```
<div className="container relative mx-auto px-4 pb-16 pt-6 md:pb-24 md:pt-10">
```

Apply the equivalent reduction (from `pt-24 md:pt-32` → `pt-6 md:pt-10`) to the hero container on `SolutionPage.tsx`.

## Scope guardrails
- Only the hero top padding changes. Bottom padding, typography, grid layout, badge, headline, description, CTA buttons, and screenshot/video panel stay identical.
- Benefits section and CTA section spacing untouched.
- `src/pages/Index.tsx` (homepage) untouched.
- No changes to `Navigation.tsx` or global CSS.
