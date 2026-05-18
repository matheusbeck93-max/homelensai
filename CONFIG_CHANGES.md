# Configuration changes required outside this branch

The following changes cannot be encoded in this branch — they require manual
action by an operator with Supabase / Stripe / repo admin access. Apply them
when merging this PR.

## After merging migrations

### 1. Verify the subscription tamper trigger fires correctly

The migration `20260517205119_secure_subscription_columns.sql` installs a
trigger that blocks non-service-role updates to subscription_status,
subscription_renews_at, and subscription_cancel_at. Verify after applying:

```sql
-- This should FAIL with the trigger's exception:
update public.profiles set subscription_status = 'premium' where id = auth.uid();

-- This should succeed (service role bypasses):
-- (Use the Supabase service role key.)
```

If the trigger fires when `check-subscription` or `manage-subscription`
edge functions run (they use the service role key), edit the function
`prevent_subscription_tamper` to expand the bypass condition.

## Supabase Functions dashboard cleanup

The five edge functions deleted in this branch are removed from
`supabase/config.toml`, but if any of them were ever deployed to
production they still exist in the Supabase project. Remove them:

```bash
supabase functions delete ai-analyze-property
supabase functions delete ai-build-search-spec
supabase functions delete ai-suggest-location
supabase functions delete compare-properties
supabase functions delete market-snapshot
```

(`search-listings` and `manage-subscription` are NOT deleted — they have
live call sites from the frontend.)

## Stripe webhook (deferred to a follow-up branch)

The subscription audit's P0-2 (Stripe webhook handler) is not in this
branch because it requires `STRIPE_WEBHOOK_SECRET` to be set in the
Supabase project secrets, and the webhook endpoint must be configured in
the Stripe dashboard. Track as a follow-up:

1. Generate a webhook signing secret in Stripe dashboard → Developers →
   Webhooks → Add endpoint pointing at
   `https://<project>.supabase.co/functions/v1/stripe-webhook`.
2. `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`
3. Create `supabase/functions/stripe-webhook/index.ts` per the
   subscription fix prompt's P0-2.

Without the webhook, subscription state is stale by up to the
`useSubscription` polling interval (currently 5 min).

## Cron auth secret (NEW — this branch)

This branch adds `requireCronAuth()` to `check-property-alerts` and
`send-weekly-picks`. Without the secret being set, those functions
will return 500 for every invocation (including the legitimate cron
trigger). Setup steps:

1. Generate a secret and set it in Supabase:
   ```bash
   supabase secrets set CRON_SHARED_SECRET=$(openssl rand -hex 32)
   ```

2. Set the same value as a Postgres setting so pg_cron can read it:
   ```sql
   -- Run as a superuser in the Supabase SQL editor.
   alter database postgres set "app.settings.cron_secret" to '<same value>';
   ```

3. Update the existing cron job definitions in
   `src/lib/alertsSetup.sql` and `src/lib/weeklyPicksCron.sql` to
   include the header:
   ```sql
   net.http_post(
     url := current_setting('app.settings.supabase_url') || '/functions/v1/check-property-alerts',
     headers := jsonb_build_object(
       'Content-Type', 'application/json',
       'X-Cron-Secret', current_setting('app.settings.cron_secret')
     )
   );
   ```

4. Re-run the cron schedule SQL to register the updated invocation.

Verify with `select cron.run_now('check-property-alerts');` — should
succeed. Curl the function URL without the header — should 401.

## Stripe webhook setup (NEW — this branch)

The `stripe-webhook` edge function is in this branch but is INERT until
`STRIPE_WEBHOOK_SECRET` is set. With the secret missing the function
returns 500 for every request, so it's safe to deploy without the
external setup — it just doesn't do anything yet.

Setup steps:

1. Stripe dashboard → Developers → Webhooks → Add endpoint:
   - URL: `https://<project>.supabase.co/functions/v1/stripe-webhook`
   - Events to send: `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`,
     `invoice.payment_failed`, `checkout.session.completed`.
   - Copy the signing secret (starts with `whsec_`).

2. Set the secret in Supabase:
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   ```

3. Test with the Stripe CLI:
   ```bash
   stripe trigger customer.subscription.deleted
   ```
   Verify the user's `profiles.subscription_status` flips to 'free'.

4. After the webhook is live, consider tightening `useSubscription`'s
   polling interval from 5 minutes to a Realtime postgres-changes
   subscription on the profiles row. See the subscription fix prompt
   P0-2 "Tighten useSubscription polling" section for the code.

## AI credits follow-up (NEW — this branch only handles the precheck side)

This branch adds `precheckAiCredits` to:
  - elevenlabs-tts (with character-based deduction)
  - calculator-insights (with token-based deduction)
  - neighborhood-personality, market-trends, neighborhood-insights,
    get-state-tax-data (precheck only — see note below)

The precheck-only functions still need `deductAiCredits` wired at their
respective AI-call completion points. Without that, every call falls
through to the `MIN_CREDITS_PER_REQUEST = 1` floor regardless of actual
token consumption — under-charges for expensive calls but still meters.

Adding accurate deduction requires per-function knowledge of where the
LLM response is built (the functions use a mix of `callAiGateway` and
direct Perplexity `fetch`). Track as a small follow-up. The
homelens_public_endpoints_fix_prompt.md P0-5 section has the canonical
pattern.

Other LLM-using functions still NOT enforced (track as follow-up):
  - ai-analyze (audit P0-1, will need precheckAiCredits)
  - ai-search, property-assistant, compare-properties-ai
  - generate-image, investment-projections, fetch-property
  - realtime-token (special — flat-rate charge for token issuance,
    not per-token)
