## 1. Google Search Console — pages not indexed

**Diagnosis (verified via GSC URL Inspection API):**

- The sitemap reports 26 URLs submitted, 0 indexed under the `https://homelensais.com/` property, but URL Inspection against `sc-domain:homelensais.com` shows key routes ARE indexed (`/`, `/pricing`, `/blog`). The "0 indexed" number in the URL-prefix property is misleading — the domain property is the source of truth.
- Real issue: feature/solution routes report `userCanonical: https://homelensais.com/` while `googleCanonical` is the route itself. That means every marketing page is declaring the homepage as its canonical, so Google can consolidate them into `/` and drop them as duplicates.
- Root cause: `index.html` ships a hard-coded `<link rel="canonical" href="https://homelensais.com/" />`. Pages that don't set their own canonical via Helmet (`FeaturePage`, `SolutionPage`, `Faq`, `Auth`, `Compare`, `MyProperties`, `Console`, `Profile`, `ProfileSetup`, `Settings`, `NotFound`, `ExtensionPrivacy`, `Accessibility`, `CCPANotice`, `CookiePolicy`, `DMCAPolicy`, `DoNotSell`, `FairHousing`, `SavedAnalyses`, `OwnedPropertyDetail`, `admin/*`, `account/*`) inherit that homepage canonical.
- Same problem for `og:url` (also hard-coded to `/` in `index.html`).

**Fix:**

- Remove `<link rel="canonical">` and `<meta property="og:url">` from `index.html` (leave the rest of the sitewide OG/Twitter tags as fallbacks).
- Add a tiny `<SeoCanonical />` helper (using `react-helmet-async`) that emits `<link rel="canonical">` and `<meta property="og:url">` for the current pathname (`https://homelensais.com${pathname}`). Drop it into every public/indexable route that doesn't already set its own canonical via Helmet. Pages that already emit a Helmet canonical (`Blog`, `BlogPost`, `Pricing`, `PrivacyPolicy`, `TermsOfService`, `Calculators`, `Chats`, `InvestorCalculator`, `InvestorBrief`, `OpenHouses`, `PropertyDetail`) stay untouched.
- Priority coverage: `Index`, `FeaturePage`, `SolutionPage`, `Faq`, `Auth`, `Compare`, all remaining `pages/*.tsx` marketing/legal routes.
- No sitemap changes needed. No robots.txt changes.

## 2. Mobile / tablet drawer — can't scroll the features list

**Diagnosis:** In `src/components/Navigation.tsx` the mobile `SheetContent` renders a fixed-height panel (`h-full`, `p-6`) with a non-scrolling `<div className="flex flex-col gap-4 mt-6">`. When the Features accordion expands, its list overflows below the viewport and there's no scroll container, so tablet/mobile users can't reach the last items.

**Fix:** Make the drawer content scroll.

- Update the `SheetContent` on the mobile branch of `src/components/Navigation.tsx` to `w-[300px] flex flex-col p-0` (kill the default `p-6` so scroll can span edge-to-edge).
- Wrap the existing header + body: keep `SheetHeader` in a fixed top region with padding, and put the scrollable body (`PublicNavMobile` / `navItems` / auth buttons) inside a `flex-1 overflow-y-auto px-6 pb-6` container.
- No changes to `PublicNav.tsx` or the desktop layout. No design tokens changed.

## Verification

- Rebuild, load `/`, `/features/property-analysis`, `/solutions/*`, `/pricing`, `/faq` and view page source: each route now shows `<link rel="canonical" href="https://homelensais.com{path}">` and matching `og:url`.
- After deploy, re-run URL Inspection on a feature URL and confirm `userCanonical` matches `googleCanonical`. Ask user to click "Request Indexing" in GSC for any high-priority page.
- Open mobile/tablet drawer, expand Features and Solutions, confirm the list scrolls to the last item and Pricing/FAQ/Sign-in remain reachable.
