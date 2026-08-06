# Truth-in-pricing fixes + AI spend baseline

All four points check out, with one important twist on Match Score. Verified against the code and the live database.

## What I verified

1. **"Unlimited" is wrong.** Buyer chat is hard-capped at 500/month (Free 20, Investor 2,000) and the cap is actively enforced on every AI call. The pricing page and master doc both promise "Unlimited chat". Real mismatch, real one-star risk.
2. **Match Score is already free — accidentally.** The `MATCH_SCORE` gate exists in both the frontend and backend feature-gate maps, but it is **never called anywhere**. The score is emitted whenever the user has completed onboarding, regardless of tier. So today: free users already get it, and the pricing page tells them they don't. Worst of both worlds — no trial value advertised, no revenue protected.
3. **Daily and monthly AI caps are identical.** Both default maps are `{ free: 1, buyer: 10, investor: 25 }`, despite code comments describing $0.10/$0.50/$1.50 daily and $3/$12/$40 monthly. The daily cap can never bind: a Buyer could burn $10 on day one and be locked out for the rest of the month. Oversight confirmed.
4. **Spend data exists but is thin.** 174 production calls, 7 users, Jun 8 - Aug 4. Enough for a directional baseline, not a forecast.

## Actual AI spend (production rows, dev calls excluded)

| Tier | Calls | Users | Total | Avg / call |
|---|---|---|---|---|
| Free | 22 | 6 | $0.17 | $0.0075 |
| Buyer | 20 | 3 | $0.17 | $0.0087 |
| Investor | 124 | 2 | $2.04 | $0.0165 |

Per-user reality: the heaviest user spent **$1.47 across 5 active days** (~$0.29/active day); the most consistent user spent **$0.90 across 22 active days** (~$0.04/active day, ~$1.20/month equivalent). Costliest surfaces: investor chat $0.029/call, general chat $0.018, extension listing analysis $0.013.

Implication: real utilisation is running at roughly **5-15% of the cap ceiling**, not 100%. Gross margin on a $9.97 Buyer looks healthy at observed behaviour; the ceilings are the risk, not the average.

## Changes to make

### 1. Replace "unlimited" everywhere
- `src/lib/subscriptionPlans.ts`: Buyer (monthly + annual) becomes "500 chats a month — more than most buyers use in an entire search". Investor becomes "2,000 chats a month". Free becomes "20 chats a month".
- Same treatment for "Unlimited property analysis" and "Unlimited Google Extension analysis" — state the real numbers.
- Rewrite the Part 3 pricing tables in the master-doc generator and regenerate the DOCX.

### 2. Make Match Score explicitly free, capped at 3/day
- Move `MATCH_SCORE` and `INVESTMENT_SCORE` to `['free','buyer','investor']` in both gate maps.
- Actually enforce it: reuse the existing `daily_analysis_count` counter (already 3/day for Free) so scoring rides the analysis cap instead of adding a second one. Paid tiers unaffected.
- Pricing page: move Match Score out of Free's "Not included" list into its features as "Match Score — 3 property analyses a day"; Buyer/Investor keep it uncapped.
- Add a soft in-chat upsell when a free user hits the third score of the day.

### 3. Fix the AI budget cap ladder
- Split the two maps so daily actually binds: daily `{ free: 0.15, buyer: 0.60, investor: 1.50 }`, monthly `{ free: 1, buyer: 10, investor: 25 }`.
- Daily x 30 now sits above monthly on purpose: daily stops one-day runaway, monthly protects margin. Both sit roughly 10x above observed per-user spend, so no real user is affected today.
- Env overrides stay as they are; only the defaults and the stale comments change.

### 4. Ground GTM section 6 in measured numbers
- Replace the guessed utilisation figures with the table above, labelled as a small-sample baseline (7 users, 2 months).
- Add a note to re-pull the numbers once there are 50+ paying users, before any paid-acquisition spend decision.

## Technical notes

- Files touched: `src/lib/subscriptionPlans.ts`, `supabase/functions/_shared/featureGates.ts`, `supabase/functions/_shared/ai/budgetGuard.ts`, `src/lib/subscription.ts` (score-aware cap), `src/pages/Pricing.tsx` if the copy structure needs it, plus the master-doc generator scripts.
- No database migration required — `daily_analysis_count` and `monthly_chat_count` already exist and reset correctly.
- No change to the enforcement path in `_shared/ai/router.ts`; only the numbers and the gate map move.