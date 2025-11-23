-- Smart Alerts Cron Job Setup
-- This SQL enables the pg_cron extension and schedules the property alerts check
-- Run this ONCE using the supabase--insert tool after deploying the check-property-alerts function

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the property alerts check to run every 6 hours
-- This checks for property price drops and status changes
SELECT cron.schedule(
  'check-property-alerts',
  '0 */6 * * *', -- Every 6 hours at minute 0
  $$
  SELECT
    net.http_post(
        url:='https://yckcdxtatwolzilboahx.supabase.co/functions/v1/check-property-alerts',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlja2NkeHRhdHdvbHppbGJvYWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzMDk3MTEsImV4cCI6MjA3Njg4NTcxMX0.MyOrW96L1QrSXoHaeU-XcR35-YEeqxKLxxc2pZJYww4"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- To view all scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule the job (if needed):
-- SELECT cron.unschedule('check-property-alerts');
