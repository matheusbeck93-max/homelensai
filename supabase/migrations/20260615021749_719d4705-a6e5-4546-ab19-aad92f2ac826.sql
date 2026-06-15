-- Rolling 7-day RentCast cache hit-rate view. Used for the +7-day audit
-- referenced in the rentcast integration memory. Reads only — no GRANT to
-- anon. Edge functions / service_role and authenticated admins can SELECT.
CREATE OR REPLACE VIEW public.rentcast_cache_hit_rate_7d AS
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