# Ship Plan: Cap UX Fan-out + Top-Up Credits + Sonnet Flag-On

Three PRs land together; flag-on is an ops step after merge.

---

## PR A — Cap UX fan-out to remaining surfaces

Wire the existing `useBudgetCap` hook + `BudgetCapBanner` + `BudgetCapBlocker` into every surface that still lacks it. Each integration is ~5 lines (banner above composer, blocker on cap-hit, disable input/button).

Surfaces to wire:
1. **InvestorChatPanel** — composer banner + blocker, disable send.
2. **MyPropertiesStrategy** (owned-property strategy panel) — same pattern.
3. **OwnedPropertyChat** — same pattern.
4. **Investor Brief refresh + Deep Dive** buttons — disable on `exceeded`, tooltip "Daily cap reached", show blocker inline.
5. **Artifact generation** (Excel workbook + PDF generators in chat) — gate the generate button + refinement.
6. **Chrome Extension popup** — inject blocker banner; CTA links to `https://homelensais.com/console` (not Stripe directly — extension users won't tab-switch for payment).
7. **Background jobs** — `check-property-alerts`, `property-valuation-refresh`, `send-weekly-picks`: catch `BudgetExceededError` server-side, silent-skip, log telemetry event `budget_cap_hit_background` to `ai_usage_log` metadata (no user-visible error).

Pattern reused — no new components required.

---

## PR B — Top-Up Credits

### B1. Database (`user_credits` table)
- Columns: `id`, `user_id`, `amount_usd numeric(8,4)`, `consumed_usd numeric(8,4) default 0`, `pack_size text` (small/medium/large), `stripe_session_id text unique`, `purchased_at`, `expires_at` (30d), `status` (active/exhausted/expired/refunded).
- RLS: owner read; service-role writes (webhook + budget guard).
- Index on `(user_id, status, expires_at)`.
- GRANTs per project rule.

### B2. Stripe products
- Need three one-time Price IDs (Small $5, Medium $10, Large $25). I will create these via Stripe MCP and pin to env vars: `STRIPE_CREDIT_PACK_SMALL_PRICE_ID`, `_MEDIUM_`, `_LARGE_`.
- Bonuses: Small $5→$5, Medium $10→$11, Large $25→$30.

### B3. `_shared/credits.ts`
Helpers: `getActiveCreditBalance(userId)`, `consumeCredits(userId, amountUsd)` (oldest-first via FIFO on `purchased_at`; flip row to `exhausted` when fully consumed), `expireOldCredits()`.

### B4. `budgetGuard.ts` extension
- After computing daily spend vs cap: if over cap, query active credit balance. If `>0`, allow; mark request to consume credits in `usageLogger` post-call.
- Update `buildBudgetExceededPayload` to include `credits_balance_usd` and a `topup` block (packs + checkout URLs) — only for `buyer`/`investor`; `topup.available=false` for `free`.

### B5. Edge functions
- **`buy-credits`** (new): authed; body `{ pack: 'small'|'medium'|'large' }`; resolves price ID; creates Stripe Checkout `mode=payment` session with metadata `{ user_id, pack_size, credit_usd }`; returns `{ url }`.
- **`stripe-webhook`** (extend): on `checkout.session.completed` where mode=`payment` and price matches a credit-pack ID, insert `user_credits` row with `expires_at = now() + 30 days`; emit `topup_completed` telemetry.

### B6. Frontend
- Extend `BudgetCapBlocker.tsx`: render three pack cards below upgrade CTA when `payload.topup.available`. Each card shows price, credit value, bonus label. Click → invoke `buy-credits` → `window.open(url)`.
- Success route handling: on return to app, toast "+$X in credits added". (Existing Stripe success URL pattern; reuse `/console?topup=success`.)
- Account section in `Console.tsx`: "AI Credits: $X.XX remaining (expires …)" with "Buy more credits" link that opens the same pack picker in a small dialog (`TopUpDialog.tsx`). Available anytime, not only on cap-hit.

### B7. `useBudgetCap` hook
Surface `creditsBalanceUsd`, `topup` from 402 payload; expose `buyPack(size)` helper.

### B8. Telemetry events
Dispatch via existing `window.dispatchEvent` pattern + log to `upgrade_cta_events`-style table (reuse if shape fits, else add columns): `topup_offered`, `topup_pack_clicked`, `topup_completed`, `topup_consumed`, `topup_expired`.

---

## PR C — Flag-on rollout (ops, no code)

After PRs A + B merged and verified:

1. **Pre-flight**: confirm Anthropic Tier 2, key smoke test, spend cap set, budget caps match spec (`free 0.10 / buyer 0.50 / investor 1.50 / unlimited 20`).
2. **Batch 1**: flip `AI_ROUTER_*_ENABLED` for preferences_assistant, investor_brief, extension_listing_analysis, ai_analyze, alerts_engine → wait 1h.
3. **Batch 2**: artifact_generation, my_properties_strategy → wait 1h.
4. **Batch 3**: investor_chat, general_chat → watch 2h.
5. 48h monitor; eval suite daily; legacy-path delete PRs queued for ~day 10.

Abort triggers (per surface): silent-fallback >5% / 10min, Anthropic 429 spike, 5xx >2× baseline, ≥3 user reports/hr, daily spend >2× projection.

---

## Technical notes

- **Credit consumption point**: deduct in `usageLogger.ts` after a successful AI call when the request was admitted via credits (mark via a `usedCredits: true` flag returned from `checkBudget`). Pay against oldest active row; spill across rows if needed.
- **Atomicity**: credit consumption uses a service-role `update` with `where consumed_usd + delta <= amount_usd`; loop across rows if delta spans multiple.
- **Refunds/expiry**: nightly cron (existing pg_cron infra) flips `status='expired'` for rows past `expires_at`.
- **Free-tier guard**: `buy-credits` rejects free users with 403; UI hides packs for free tier.
- **Background-job skip**: `BudgetExceededError` in non-interactive callers becomes a no-op + log entry rather than 402 response.

---

## Open question for you

Stripe: do you want me to **create the three one-time credit-pack products via Stripe MCP now** (recommended — they'll be pinned to live Price IDs immediately), or will you create them in Stripe Dashboard and send me the three Price IDs?

If "create now", I'll provision `prod_*` + `price_*` in your live Stripe and store the three Price IDs as env-var secrets (`STRIPE_CREDIT_PACK_{SMALL,MEDIUM,LARGE}_PRICE_ID`) so swapping environments later is config-only.
