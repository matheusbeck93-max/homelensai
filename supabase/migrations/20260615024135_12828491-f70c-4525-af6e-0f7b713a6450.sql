
CREATE TABLE public.rentcast_cache_hit_rate_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  total_calls INTEGER NOT NULL,
  cache_hits INTEGER NOT NULL,
  hit_rate_pct NUMERIC(5,2) NOT NULL,
  threshold_pct NUMERIC(5,2) NOT NULL DEFAULT 70.00,
  min_sample_size INTEGER NOT NULL DEFAULT 20,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.rentcast_cache_hit_rate_alerts TO authenticated;
GRANT ALL ON public.rentcast_cache_hit_rate_alerts TO service_role;

ALTER TABLE public.rentcast_cache_hit_rate_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view rentcast cache alerts"
ON public.rentcast_cache_hit_rate_alerts
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can acknowledge rentcast cache alerts"
ON public.rentcast_cache_hit_rate_alerts
FOR UPDATE
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_rentcast_cache_alerts_unack
  ON public.rentcast_cache_hit_rate_alerts (created_at DESC)
  WHERE acknowledged_at IS NULL;
