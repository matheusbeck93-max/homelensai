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
