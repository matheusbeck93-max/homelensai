## Goal

1. Fix the homepage pricing CTAs so a logged-out visitor can subscribe directly to Buyer / Investor instead of seeing "Upgrade to…".
2. Extend first-time onboarding (`/profile-setup`) with a plan-selection step so every new user actively picks Free, Buyer, or Investor before landing in the app.
3. Manually verify both flows end-to-end in the preview.

## 1. Homepage pricing CTA (`src/components/PricingSection.tsx`)

The home pricing block currently always shows `plan.ctaLabel` ("Upgrade to Buyer" / "Upgrade to Investor"), which is wrong for visitors who are not yet logged in.

Changes:
- Track auth state in `PricingSection` with a small `useEffect` calling `supabase.auth.getSession()` + `onAuthStateChange` (mirror the pattern already used in `Pricing.tsx`).
- Override the button label when the user is logged out:
  - Free → "Get started free"
  - Buyer → "Subscribe to Buyer"
  - Investor → "Subscribe to Investor"
- When logged in, keep the existing `ctaLabel` from `subscriptionPlans.ts` (so paid users still see "Upgrade…" / "Current plan" handling on `/pricing`).
- Click behavior:
  - Logged out → `navigate('/auth?redirect=/pricing&plan=<tier>')` for Buyer/Investor; Free stays `navigate('/auth')`.
  - Logged in → keep the current `navigate('/pricing')`.
- No copy/label changes inside `subscriptionPlans.ts` (those labels are still correct on the `/pricing` page where everyone reaching it is assumed to be an existing customer).

Optional polish: in the section sub-headline, change "Upgrade to Buyer for full home-buying tools, or Investor for rental-property analysis." to "Pick Buyer for full home-buying tools, or Investor for rental-property analysis." so it reads correctly for first-time visitors as well.

## 2. Onboarding plan step (`src/pages/ProfileSetup.tsx` + small helper)

Today onboarding is a 2-step flow: **Preferences → Investor focus → `/investor`**. Add a third required step: **Choose your plan**.

Step model becomes `'prefs' | 'persona' | 'plan'`. Update the stepper header to show "1. Preferences · 2. Investor focus · 3. Plan".

After persona is saved, instead of `navigate('/investor')`, advance to `step = 'plan'`.

New `PlanStep` UI (inline component in `ProfileSetup.tsx`, no new route):
- Renders the three plans (Free / Buyer / Investor) using `SUBSCRIPTION_PLANS` from `src/lib/subscriptionPlans.ts`. Reuse the same compact card visuals as `PricingSection` (extract a tiny presentational sub-component or import a stripped version — implementation detail, no new public API).
- Monthly/annual toggle (same component as the homepage). Default monthly.
- Buttons:
  - Free → updates `profiles.subscription_status = 'free'` (if column exists; otherwise just marks onboarding complete) and navigates to `/investor` (or `/` if persona was buyer-only — keep current default of `/investor` to avoid behavior churn).
  - Buyer / Investor → calls the existing `supabase.functions.invoke('create-checkout', { body: { priceId } })` with the selected plan's `stripePriceId`. On success, `window.open(url, '_blank')` (same UX as `Pricing.tsx`) and stay on the plan step with a toast "Complete your payment in the new tab — your plan will activate automatically". A secondary "Continue with Free for now" link lets them proceed even if they close the checkout tab; this writes `subscription_status = 'free'` and routes to `/investor`.
- Mark this step as required: do not allow `/profile-setup` to redirect away until the user clicks one of these buttons. Onboarding-complete flag is already set when persona saves, so the existing `Profile.tsx` redirect (`if (profile && !profile.onboarding_completed) …`) won't accidentally bounce them out. No changes needed there.

Note on the AI personalization tie-in the user mentioned ("chat only uses preferences in Buyer/Investor plans"): no code change required. Per `mem://ai/logica-de-ativacao-da-personalizacao`, personalization already activates from profile data; gating is owned by the existing tier checks in chat. The new plan step simply makes sure a tier gets selected.

## 3. Manual verification in the preview

After the changes are deployed:
1. Log out, open `/`, scroll to pricing → confirm buttons read "Get started free", "Subscribe to Buyer", "Subscribe to Investor" and that clicking Buyer/Investor goes to `/auth?redirect=/pricing&plan=buyer|investor`.
2. Log in as an existing paid user, refresh `/` → confirm CTAs revert to the original "Upgrade…" labels (sanity check that we didn't regress the logged-in path).
3. Register a brand-new account → confirm flow is Preferences → Investor focus → **Plan** → `/investor`. Verify "Continue with Free for now" works and that picking Buyer opens Stripe checkout in a new tab while keeping the user on the plan step.
4. Screenshot the new plan step and confirm there are no console errors (`code--read_console_logs`).

## Files

Edit:
- `src/components/PricingSection.tsx` — auth-aware CTA labels + routing.
- `src/pages/ProfileSetup.tsx` — add `'plan'` step, render plan selector, wire `create-checkout`.

Read-only references:
- `src/pages/Pricing.tsx` — pattern for `create-checkout` + auth state.
- `src/lib/subscriptionPlans.ts` — plan metadata, no edits.

No DB migrations, no edge function changes, no new files.

## Out of scope

- Rewriting `/pricing` itself.
- Changing personalization/gating logic in chat (already correct per memory).
- Removing or renaming the existing "Upgrade to …" labels in `subscriptionPlans.ts` (they remain accurate on `/pricing` for existing users).
