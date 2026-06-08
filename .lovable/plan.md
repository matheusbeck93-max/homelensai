# Plan

Three independent workstreams. Each can ship on its own.

---

## 1. My Properties — Edit & Delete

Today `OwnedPropertyCard` only navigates to the detail page; there is no edit or delete path on the My Properties list, and `AddPropertyDialog` is create-only.

**UI**
- Add a "⋮" menu (shadcn `DropdownMenu`) to the top-right of `OwnedPropertyCard`, stopping propagation so it doesn't trigger the card's `onClick`. Items: **Edit details**, **Delete**.
- New `EditPropertyDialog` (lift the field set out of `AddPropertyDialog` into a shared `OwnedPropertyForm`; reuse for both create and edit). Pre-fills from the selected property and updates `investor_owned_properties` on save. Keep the existing `EditValuationDialog` as a quick path on the detail page; the new dialog covers the full record (address, type, beds/baths, purchase, loan, rented/owner-occupied flags).
- Delete: `AlertDialog` confirm → soft-delete by setting `status = 'archived'` (keeps history; matches the existing `.eq('status','active')` filter in `useOwnedProperties`). Mention "you can re-add it later". Hard delete is out of scope for v1.

**Wiring**
- `MyProperties.tsx` holds `editTarget` / `deleteTarget` state, renders the new dialogs once, passes setters down through `OwnedPropertyCard` via `onEdit` / `onDelete` props.
- Both actions call `reload()` from `useOwnedProperties` on success and `toast` success/error.

**Files**
- new: `src/components/investor/my-properties/OwnedPropertyForm.tsx` (extracted from AddPropertyDialog)
- new: `src/components/investor/my-properties/EditPropertyDialog.tsx`
- edit: `AddPropertyDialog.tsx` (use shared form), `OwnedPropertyCard.tsx` (menu), `MyProperties.tsx` (state + dialogs)
- RLS on `investor_owned_properties` already restricts to owner; no migration needed.

---

## 2. Investor Brief — Faster Refresh

Current refresh round-trip:
`composeBriefCards` (parallel data loads, fast) → `investor-brief` edge fn → insert `brief` row → insert N `cards` → Gemini 2.5 Pro narration (~3–8s, the bottleneck) → finalize → client reloads via two more selects. UI shows a skeleton on the right and nothing on the left until everything returns.

**Wins (in order of impact)**

1. **Model swap for free/buyer narration.** Brief narration is a short JSON over already-summarized cards — Pro is overkill. In `investor-brief/index.ts`, drop the hardcoded `google/gemini-2.5-pro` and use the router for all tiers (it's already imported and used for the flagged path). Free/buyer route to `gateway:standard` (Sonnet, fast); investor keeps `gateway:premium`. Removes the slow legacy fallback as the default.
2. **Render cards before narration finishes.** The composed cards exist on the client before the edge call. Update `useInvestorBrief.regenerate` to call `setBundle` with the freshly composed cards (and the previous brief's intro/insights kept visible) immediately, then patch in the new intro/insights when the edge function returns. Removes the "blank right column during refresh" feeling.
3. **One round-trip for the reload.** Return the full brief + cards from `investor-brief` (already done) and stop the post-call `loadLatest()` re-fetch — just hydrate from the response. Saves two sequential selects.
4. **Tighten auto-refresh debounce.** Today realtime events fire `regenerate({silent})` after 2.5s; multi-table edits stack. Coalesce all four channels with a single 5s debounce and skip if `refreshing` is already true.
5. **Trim narration prompt.** Pass only `id`, `type`, `title`, `summary` (already done) but cap each summary to 240 chars before send. Shorter prompt → faster TTFB.

**Out of scope (flag for later)**: true streaming of the narration; today a non-streaming JSON response is required for parsing.

**Files**
- edit: `supabase/functions/investor-brief/index.ts` (router for all tiers, drop legacy path as default, return final shape)
- edit: `src/hooks/useInvestorBrief.ts` (optimistic compose, hydrate from response, debounce)

---

## 3. Plan Limits & Rate Limiting — Audit + Close Gaps

`budgetGuard.ts` caps spend per tier (free $0.10, buyer $0.50, investor $1.50 / UTC day) but the guard only fires on surfaces that call the router via `completeWithFallback`. Audit results:

| Edge function | Routed through guard? |
|---|---|
| `ai-chat`, `ai-analyze`, `investor-chat`, `investor-brief`, `preferences-assistant`, `send-weekly-picks` | ✅ |
| `owned-property-chat` | ❌ direct Gateway call |
| `perplexity-chat` | ❌ (Perplexity, not Lovable AI — separate cost) |
| `calculator-insights` | ❌ |
| `compare-properties-ai` | ❌ |
| `neighborhood-personality`, `neighborhood-insights` | ❌ |
| `property-assistant` | ❌ |
| `preferences-chat` | ❌ |

**Actions**
- Add the missing surface ids to `SurfaceId` / `SURFACE_CONFIG`: `owned_property_chat`, `compare_properties`, `neighborhood_insights`, `calculator_insights`, `property_assistant`, `preferences_chat`. Map free/buyer → `gateway:standard`, investor → `gateway:premium` (`gateway:standard` fallback) by default; `compare_properties` and `property_assistant` use the buyer→PRE pattern from `my_properties_strategy`.
- Migrate each of the above edge functions to `completeWithFallback(surfaceId, …, { userId, tier })` behind `isSurfaceEnabled` (same pattern as `investor-brief`), returning the structured 402 from `buildBudgetExceededPayload` on `BudgetExceededError`. Keep the legacy direct-gateway path as fallback when the flag is off, so this is safe to roll incrementally.
- `perplexity-chat` is a separate provider, so the $-cap doesn't apply. Add a per-tier **request-count** ceiling for it (free 10/day, buyer 60/day, investor 200/day) using the existing `ai_usage_log` table (count rows where `provider='perplexity'`). Helper lives next to `budgetGuard.ts` as `checkPerplexityQuota(userId, tier)`.
- Verify front-end coverage of the new 402 payloads: every page that calls these functions already either uses `useBudgetCap` (Chats, Calculators, PropertyDetail, etc.) or will after surface integration; sweep the remaining call sites (compare page, neighborhood widgets) to wire `parseAndRecordBudget402` + `<BudgetCapBlocker>` in line with the existing pattern.
- No client rate-limiter is being added (per the no-backend-rate-limiting directive); per-tier $ caps + per-day Perplexity request caps are the enforcement mechanism, both server-side.

**Verification**
- Re-run `budgetGuard_test.ts` and `router_test.ts`; add a `perplexityQuota_test.ts` (count math, reset boundary).
- Manual: with a free account, hit chat repeatedly and confirm the cap triggers `<BudgetCapBlocker>` on each migrated surface; same for Perplexity quota.
- Inspect `ai_usage_log` via supabase read query after a session to confirm rows for the newly-migrated surfaces carry their `surface_id`.

---

## Suggested merge order

1. PR-A: My Properties edit/delete (UI only).
2. PR-B: Investor Brief speed-ups (low risk, isolated to the brief path).
3. PR-C: Plan-limit audit (surface registrations + per-function migration); ship one or two functions per PR so the rollback blast-radius stays small.
