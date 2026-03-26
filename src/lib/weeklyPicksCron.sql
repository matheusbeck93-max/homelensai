-- Weekly Picks Cron Job Setup
-- This SQL schedules the weekly picks to run every day at 9 AM
-- The function will check which users should receive picks based on their preferred day
-- Run this ONCE using the supabase--insert tool after deploying the send-weekly-picks function

-- Schedule the weekly picks check to run every day at 9 AM
SELECT cron.schedule(
  'send-weekly-picks',
  '0 9 * * *', -- Every day at 9:00 AM
  $$
  SELECT
    net.http_post(
        url:=current_setting('app.settings.supabase_url') || '/functions/v1/send-weekly-picks',
        headers:=jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.anon_key')),
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- To view all scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule the job (if needed):
-- SELECT cron.unschedule('send-weekly-picks');
