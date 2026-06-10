
-- 1. Staff flag on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_staff boolean NOT NULL DEFAULT false;

-- 2. Defensive backfill (no-op today, but locks the invariant)
UPDATE public.profiles
SET subscription_status = 'free'
WHERE subscription_status IS NULL
   OR subscription_status NOT IN ('free','buyer','investor');

-- 3. Materialized view for the Usage page (60-day window)
DROP MATERIALIZED VIEW IF EXISTS public.v_user_usage_daily;

CREATE MATERIALIZED VIEW public.v_user_usage_daily AS
SELECT
  user_id,
  usage_date AS day,
  surface,
  COUNT(*)::bigint AS calls,
  SUM(cost_usd)::numeric(14,6) AS usage_usd
FROM public.ai_usage_log
WHERE created_at > (now() - interval '60 days')
GROUP BY user_id, usage_date, surface;

CREATE UNIQUE INDEX IF NOT EXISTS v_user_usage_daily_pk
  ON public.v_user_usage_daily (user_id, day, surface);

CREATE INDEX IF NOT EXISTS v_user_usage_daily_user_day
  ON public.v_user_usage_daily (user_id, day DESC);

GRANT SELECT ON public.v_user_usage_daily TO service_role;
-- Authenticated reads go through the usage-summary edge function (service-role
-- + auth.uid() filter), so no direct grant to authenticated needed.
