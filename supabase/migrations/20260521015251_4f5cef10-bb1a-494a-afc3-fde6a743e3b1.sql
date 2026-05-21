revoke execute on function public.prevent_subscription_tamper() from public;
revoke execute on function public.prevent_subscription_tamper() from authenticated;
-- NOTE: pg_net cannot be relocated via ALTER EXTENSION SET SCHEMA (Postgres
-- error 0A000). Dropping and recreating would invalidate active cron jobs
-- (check-property-alerts, send-weekly-picks) that call net.http_post. Left in
-- public as a documented exception, matching Supabase's own guidance for pg_net.
comment on extension pg_net is 'pg_net stays in public: extension does not support SET SCHEMA and cron jobs depend on it.';