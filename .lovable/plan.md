# Budget Cap UX + Tier Migration Plan

## What you're choosing changes scope dramatically

You picked **all three stages** AND **full tier migration**. That's significantly more than the original cap-UX spec because every gate, RLS check, Stripe price, and pricing-page string in the app currently keys off `free | paid | premium` at **$4.97 Premium**. Renaming to `free | buyer | investor | unlimited` at **$9.97 / $24.97** ripples into:

- `profiles.subscription_status` enum/values
- Every `subscription_status === 'premium'` gate across the React codebase
- Stripe products + price IDs (need new ones — the old $4.97 Premium price stays for grandfathered subs)
- Pricing page copy
- The `useBudgetCap` work itself

I will need from you, **before this can ship end-to-end**:

1. **Stripe price decisions.** Should I create three new products (`Buyer $9.97/mo`, `Investor $24.97/mo`, `Unlimited $TBD/mo`)? What's the Unlimited price (spec is silent — only says "no further upgrade")? And do existing Premium subscribers stay on the old $4.97 price or get migrated/cancelled?
2. **Confirmation that `free` → `buyer` is the upgrade for current free users** (not `free` → `paid` → `premium` like today).
3. **Whether `paid` rows in the DB today should be backfilled to `buyer` or to `investor`** (today's `paid` users — there may be zero, or there may be the $4.97 Premium folks living under the `paid` flag depending on how Stripe webhook writes it).

Until I have those three answers, I can ship the **cap-UX work against the existing `free | paid | premium` model** (mapping in copy: `free`→Free, `paid`→Buyer, `premium`→Investor; show new prices) so the UX is live, and migrate the underlying tier names in a follow-up PR once Stripe is set up. That's the safe path.

## Recommended split

### PR 1 — Cap UX on the existing tier model (this turn)

Keeps `Tier = "free" | "paid" | "premium"` in the DB and router. User-visible copy uses the new names + prices. Ships:

**Backend**
- `_shared/ai-router/budgetGuard.ts` — extend `BudgetExceededError` with `usageTodayUsd`, `dailyLimitUsd`, `resetAt`, `surface`. Add `buildBudgetExceededPayload()` returning the structured shape from the spec.
- `_shared/ai-gateway.ts` — map `BudgetExceededError` → 402 with JSON body.
- New edge function `budget-status/index.ts` — `GET` returns `{ tier, usage_today_usd, daily_limit_usd, usage_pct, reset_at, warning_level }`. Reads `ai_usage_log` summed for today (UTC date).
- Tests for both the payload builder and the new endpoint.

**Frontend lib**
- `src/lib/ai/budgetCap.ts` — `useBudgetCap()` hook + Zustand-or-context store. Polls every 60s while focused; absorbs any 402 from any AI fetch to update state immediately; exposes `BudgetCapState`.
- `src/lib/ai/budgetCapFetch.ts` — fetch wrapper that recognizes 402 + budget_exceeded body and pushes into the store before re-throwing.

**Frontend components**
- `src/components/ai/BudgetCapBanner.tsx` — 75% warning pill with countdown + popover upgrade pitch.
- `src/components/ai/BudgetCapBlocker.tsx` — exceeded-state inline block with reset countdown.
- `src/components/ai/UpgradeCTA.tsx` — per-tier copy, source-tagged checkout URL, analytics `track('upgrade_cta_clicked')`.
- Countdown helpers (`formatResetCountdown`).

**Per-surface integration**
- Chat composers (general chat / `Chats.tsx`, `InvestorChatPanel`, `MyPropertiesStrategy`, `OwnedPropertyChat`) — disable input + render `BudgetCapBlocker` on exceeded; render `BudgetCapBanner` on approaching.
- Brief refresh button + Deep Dive buttons — disabled + tooltip; top-of-brief banner.
- Artifact generation entry points — disabled state + inline blocker.
- Extension popup — banner injection with link to `/console` (not Stripe directly).
- Alerts engine + property valuation jobs — catch 402, log `budget_cap_hit_background` to `investor_persona_telemetry`, no UI.

**Telemetry**
- New events into `investor_persona_telemetry`: `budget_cap_approaching_shown`, `budget_cap_hit_shown`, `budget_cap_hit_background`, `upgrade_cta_clicked`.
- `upgrade_cta_converted` is wired from the Stripe webhook (PR 3) — the click event ships now with a `cap_session_id` so the webhook can join later.

### PR 2 — Tier migration (after Stripe products are decided)

- Create `Buyer`, `Investor`, `Unlimited` Stripe products + prices via `stripe--create_stripe_product_and_price`.
- Migration: rename `subscription_status` values; backfill rule per your answer to Q3.
- Rewrite every `subscription_status === 'premium'` check (codebase-wide) to a typed helper `hasInvestorTier(profile)` etc.
- Update `budgetGuard.ts` caps mapping to the new names + the 4th tier.
- Update pricing page.

### PR 3 — Stripe-conversion event

- `create-checkout-session` accepts `cap_session_id` in metadata.
- Stripe webhook handler on `checkout.session.completed` emits `upgrade_cta_converted { from_tier, to_tier, source, cap_session_id }` if metadata present and the click is <24h old.

## Technical details

### `BudgetExceededError` shape

```ts
export class BudgetExceededError extends Error {
  constructor(
    public tier: Tier,
    public surface: SurfaceId,
    public usageTodayUsd: number,
    public dailyLimitUsd: number,
    public resetAt: string, // ISO UTC midnight tomorrow
  ) { super(...); this.name = "BudgetExceededError"; }
}
```

`budgetGuard.ts` already computes today's spend by `usage_date`; the `resetAt` becomes `new Date(Date.UTC(y, m, d+1, 0, 0, 0)).toISOString()`.

### Upgrade map (cap-UX copy, until tier migration lands)

```ts
const COPY: Record<DbTier, { displayName: string; nextDisplayName: string | null; nextPriceUsd: number | null; nextCheckoutPlan: string | null; headline: string; body: string; cta: string } | null> = {
  free:    { displayName: "Free",     nextDisplayName: "Buyer",    nextPriceUsd:  9.97, nextCheckoutPlan: "buyer",    headline: "...", body: "...", cta: "Upgrade to Buyer →" },
  paid:    { displayName: "Buyer",    nextDisplayName: "Investor", nextPriceUsd: 24.97, nextCheckoutPlan: "investor", headline: "...", body: "...", cta: "Upgrade to Investor →" },
  premium: { displayName: "Investor", nextDisplayName: null,       nextPriceUsd: null,  nextCheckoutPlan: null,        headline: "",    body: "You've used today's Investor cap — most users don't reach this. Resets at midnight.", cta: "" },
};
```

### Countdown rule

If `resetAt - now < 12h` → `Resets in Hh Mm`. Else `Resets at h:mm AM` (browser local).

### Cross-surface state

Single Zustand store keyed only by user. Mounted once at the auth provider. Any `budgetCapFetch` wrapper that sees a 402 calls `useBudgetCapStore.getState().setFromError(body)`. All consumers re-render.

### 60s polling

`useBudgetCap()` mounts a `useEffect` with `setInterval(60_000)` gated on `document.visibilityState === 'visible'` AND the consumer flagging itself as an AI surface (via a counter ref to avoid polling when no surface is active).

## Verification before handing back

1. Force 402: temporarily set cap to $0 for a test user in `budgetGuard.ts` (env override exists). `curl` general chat → response body matches spec.
2. Hit cap on chat → composer disables → blocker renders → click CTA → URL contains `source=cap_hit_general_chat`.
3. 75% warning fires before cap. No flash on transition to exceeded.
4. Brief: refresh disabled, banner at top, history visible.
5. Investor user (mapped from `premium`): blocker shows reset only, no CTA.
6. Alerts job at-cap: no UI, telemetry row written.
7. Cross-tab: hit cap in tab A, open brief in tab B — blocker present immediately via next 60s poll (or sooner if brief fetch returns 402).

## What I'd like you to confirm before I start cutting code

1. **Approve PR-split.** Ship cap UX on the existing tier model now (PR 1), then tier migration (PR 2), then Stripe webhook conversion event (PR 3). Or insist on one PR — in which case I need the Stripe answers below up front.
2. **Stripe products.** If you want PR 2 in this turn: confirm I should create Stripe products `Buyer $9.97/mo`, `Investor $24.97/mo`, and tell me the `Unlimited` price (or that it's not purchasable / admin-assigned only).
3. **Existing `paid` and `premium` users.** Should `paid` rows map to `buyer` and `premium` rows map to `investor` in the rename migration? Any grandfathering rules?
4. **Approaching threshold.** 75% (recommended) confirmed.
5. **Investor "softer" no-upgrade copy** confirmed.
