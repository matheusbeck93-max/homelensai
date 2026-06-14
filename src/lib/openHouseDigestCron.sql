-- ============================================================================
-- Open House Digest cron schedule (run via Supabase SQL editor; NOT a migration
-- because this references project-specific URLs/keys).
--
-- Prereqs:
--   - `pg_cron` and `pg_net` extensions enabled
--   - `app.settings.cron_secret` set to the CRON_SHARED_SECRET value
--   - `app.settings.supabase_url` set to the project URL
--   - `app.settings.supabase_anon_key` set to the project anon/publishable key
-- ============================================================================

-- Daily 11:00 UTC = 7:00 ET — sends "Today's open houses" to daily subscribers
select cron.schedule(
  'open-house-digest-daily',
  '0 11 * * *',
  $$
    select net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-open-house-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', current_setting('app.settings.cron_secret'),
        'apikey', current_setting('app.settings.supabase_anon_key')
      ),
      body := jsonb_build_object('frequency', 'daily')
    );
  $$
);

-- Weekly Friday 22:00 UTC = Fri 6pm ET — weekend digest
select cron.schedule(
  'open-house-digest-weekly',
  '0 22 * * 5',
  $$
    select net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-open-house-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', current_setting('app.settings.cron_secret'),
        'apikey', current_setting('app.settings.supabase_anon_key')
      ),
      body := jsonb_build_object('frequency', 'weekly')
    );
  $$
);
