
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE public.rentcast_cache_hit_rate_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_calls INTEGER NOT NULL DEFAULT 0,
  cache_hits INTEGER NOT NULL DEFAULT 0,
  hit_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rentcast_cache_hit_rate_history TO authenticated;
GRANT ALL ON public.rentcast_cache_hit_rate_history TO service_role;

ALTER TABLE public.rentcast_cache_hit_rate_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view rentcast hit rate history"
ON public.rentcast_cache_hit_rate_history
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_rentcast_hit_rate_history_window_end
  ON public.rentcast_cache_hit_rate_history (window_end DESC);
