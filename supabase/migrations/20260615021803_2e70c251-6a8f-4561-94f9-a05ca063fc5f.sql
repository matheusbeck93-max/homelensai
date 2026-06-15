-- Re-create the 7-day cache hit-rate view with security_invoker so it
-- respects the caller's permissions / RLS context (Supabase linter 0010).
DROP VIEW IF EXISTS public.rentcast_cache_hit_rate_7d;

CREATE VIEW public.rentcast_cache_hit_rate_7d
WITH (security_invoker = true) AS
SELECT
  COUNT(*)::bigint                                        AS total_calls,
  COUNT(*) FILTER (WHERE cache_hit IS TRUE)::bigint       AS cache_hits,
  COUNT(*) FILTER (WHERE cache_hit IS FALSE)::bigint      AS cache_misses,
  CASE
    WHEN COUNT(*) = 0 THEN 0::numeric
    ELSE ROUND(
      (COUNT(*) FILTER (WHERE cache_hit IS TRUE))::numeric
        / COUNT(*)::numeric * 100,
      2
    )
  END                                                     AS hit_rate_pct,
  MIN(called_at)                                          AS window_start,
  MAX(called_at)                                          AS window_end
FROM public.rentcast_usage_log
WHERE called_at >= NOW() - INTERVAL '7 days';

GRANT SELECT ON public.rentcast_cache_hit_rate_7d TO authenticated;
GRANT SELECT ON public.rentcast_cache_hit_rate_7d TO service_role;

COMMENT ON VIEW public.rentcast_cache_hit_rate_7d IS
  'Rolling 7-day cache hit rate for RentCast calls. Target: >70%. Audited at +7 days post-launch.';