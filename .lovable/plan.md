## Goal

On the homepage (`/`) only:
- Hide the current header nav items (My HomeLens, Chats, Calculators, Investor) when the user is **logged out**.
- For logged-out visitors, replace them with a row of section-link icons that scroll to homepage sections and have their own clean URLs (e.g. `/faq`), each also setting the hash (`#faq`) for in-page anchoring.
- Logged-in users keep the current nav exactly as it is today (no new icons).
- Header on every other page is unchanged.

## Section icons (logged-out, homepage)

Add anchor IDs to the existing homepage sections in `src/pages/Index.tsx` and map each to a clean route + hash:

| Icon | Label | Route | Hash | Section |
|---|---|---|---|---|
| Search | Search | `/` | `#hero` | Hero search |
| Chrome | Extension | `/extension` | `#extension` | Chrome extension block |
| TrendingUp | Investor | `/investors` | `#investors` | Investor tools grid |
| MessageSquare | Chat | `/chat-preview` | `#chat` | Chat + buying power block |
| Tag | Pricing | `/pricing-section` (anchor route) | `#pricing` | Pricing section |
| HelpCircle | FAQ | `/faq` | `#faq` | FAQ section |

(Final labels/icons are easy to tweak — these match the sections that actually exist on the homepage.)

Note: `/pricing` already exists as its own page. To avoid collision, the homepage pricing anchor uses a distinct path (e.g. `/home/pricing` or simply the hash). I'll confirm with a single route alias that does not clash with existing pages.

## Behavior

- Clicking an icon calls `navigate('/faq', { replace: false })` and then sets `window.location.hash = 'faq'` so the URL ends up as `/faq#faq` and the browser scrolls to the anchored section.
- Visiting `homelensais.com/faq` directly loads the homepage and auto-scrolls to the `#faq` section after mount.
- Active state highlights the icon whose section is currently in view (IntersectionObserver, lightweight).
- Mobile: icons collapse into the existing hamburger sheet as a "Jump to" group above the auth buttons.

## Technical changes

1. **`src/components/Navigation.tsx`**
   - Detect `location.pathname === '/'` and `!user`.
   - When both true: render a new `HomepageSectionNav` instead of `navItems`.
   - When logged in: render existing `navItems` unchanged (current behavior).
   - On non-`/` routes: unchanged.

2. **New `src/components/HomepageSectionNav.tsx`**
   - Renders the icon row (desktop) and list (mobile sheet slot).
   - Click handler: `navigate(route)` then `scrollIntoView` the matching `#hash` element.
   - IntersectionObserver to highlight the active section.

3. **`src/pages/Index.tsx`**
   - Add `id="hero" | "extension" | "investors" | "chat" | "pricing" | "faq"` to the existing `<section>` wrappers (no layout changes).
   - On mount, if `location.pathname` matches one of the new section routes OR `location.hash` is set, smooth-scroll to that section after the page paints.

4. **`src/App.tsx` (router)**
   - Add routes that render `<Index />` for: `/features`, `/extension`, `/investors`, `/chat-preview`, `/faq`, and a homepage-pricing-anchor route that doesn't conflict with the existing `/pricing` page.
   - Existing `/pricing` page route stays as-is.

5. **SEO**
   - Each alias route still serves the homepage HTML/meta — no separate `<title>` changes needed. Optional: set a per-route document title if you want (can confirm).

## Out of scope

- No business logic, no auth, no database changes.
- No styling overhaul — icons reuse the existing nav `Button variant="ghost"` style with `size="icon"` and a tooltip showing the label.

## Open mini-question (won't block)

The existing `/pricing` page already exists. For the FAQ-style homepage pricing anchor, I propose using `/#pricing` (hash only) for that one icon while all others get clean paths. If you'd rather have a clean path there too, say the word and I'll use `/plans` or similar.
