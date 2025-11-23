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
        url:='https://yckcdxtatwolzilboahx.supabase.co/functions/v1/send-weekly-picks',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlja2NkeHRhdHdvbHppbGJvYWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMDk3MTEsImV4cCI6MjA3Njg4NTcxMX0.MyOrW96L1QrSXoHaeU-XcR35-YEeqxKLxxc2pZJYww4"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- To view all scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule the job (if needed):
-- SELECT cron.unschedule('send-weekly-picks');
