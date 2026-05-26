## Goal

Make all investor-area pages (Brief, Calculator, Saved Analyses, Profile Setup) share the same layout shell with the `ConsoleSidebar` visible — including on mobile/tablet, where it becomes a horizontally scrollable strip.

## Scope

Frontend layout only. No business logic, no data model changes.

## Changes

### 1. `src/components/investor/console/ConsoleSidebar.tsx` — responsive variants

Currently `hidden lg:flex` → invisible below 1024px.

Refactor to render two variants from the same `items` array:

- **Desktop (`lg+`)**: keep current vertical rail (`hidden lg:flex w-14 / w-56`, border-r).
- **Mobile + tablet (`< lg`)**: a sticky horizontal bar directly under the global `Navigation`, full-width, `overflow-x-auto`, with each item as a pill (icon + label). Active item uses `bg-primary/10 text-primary`. Add `scrollbar-thin` styling and `snap-x` for smooth horizontal scroll. Touch targets ≥ 44px (matches mobile UX memory).

Export the horizontal version as either a second named export (`ConsoleTabBar`) or have `ConsoleSidebar` render both internally so consumers don't change. Internal rendering is simpler — recommended.

### 2. Apply shell consistently

#### `src/pages/ProfileSetup.tsx`
Wrap content in the same shell as `InvestorBrief.tsx`:
```
<div className="min-h-screen bg-background flex flex-col">
  <Navigation />
  <div className="flex flex-1 pt-20 lg:pt-16">
    <ConsoleSidebar />
    <main className="flex-1 min-w-0">
      <div className="container mx-auto px-4 py-6 lg:py-8 max-w-5xl">
        ... existing header + step content ...
      </div>
    </main>
  </div>
</div>
```
Remove the current `pt-24 pb-24 max-w-5xl` outer container.

#### `src/pages/SavedAnalyses.tsx`
Replace the current default-export wrapper:
```
<div className="min-h-screen bg-background">
  <Navigation />
  <main className="container mx-auto px-4 pt-24 pb-12 max-w-5xl">
    <SavedAnalysesContent />
  </main>
</div>
```
with the same shell as Brief/Calculator (Navigation → flex pt-20 lg:pt-16 → ConsoleSidebar + main). `SavedAnalysesContent` stays untouched and is still reusable elsewhere.

#### `src/pages/InvestorBrief.tsx` and `src/pages/InvestorCalculator.tsx`
No structural changes — they already use the shell. They automatically get the new mobile/tablet horizontal bar through the ConsoleSidebar refactor.

### 3. Layout cleanup (remove blank gaps)

- `InvestorBrief.tsx`: header uses `mb-6`; main column already grids. No change needed beyond ensuring the new mobile tab bar sits flush (no extra top padding when horizontal variant is active — adjust `pt-20 lg:pt-16` to `pt-16` since the sticky nav handles spacing; the horizontal tab bar will add its own height under it).
- `ProfileSetup.tsx`: drop redundant outer `pt-24 pb-24` once it's in the shell — the shell's `pt-20 lg:pt-16` already accounts for the sticky nav.
- `SavedAnalyses.tsx`: when rendered inside the shell with `showHeader=true`, keep its existing `mb-8` header. The empty whitespace below the cards comes from the previous double-wrapping — removed by the shell refactor.

### 4. Active-route highlighting on `/profile-setup`

`ConsoleSidebar`'s `items` array already includes `{ to: '/profile-setup', label: 'Preferences' }`, so the active state will light up automatically once the sidebar renders on that page.

## Out of scope

- No new routes, no item changes in the sidebar.
- No changes to `InvestorBriefContext`, brief cards, or chat.
- No changes to `Navigation` (top nav stays as is).

## Acceptance

- Desktop ≥ 1024px: vertical icon rail visible on `/investor`, `/investor/calculator`, `/saved-analyses`, `/profile-setup`.
- Tablet & mobile (< 1024px): horizontal scrollable pill bar visible on all four pages, just under the top nav; can scroll horizontally to reveal all four items.
- Active route highlighted in both variants.
- No empty/blank vertical sections between header and content on any of the four pages.
