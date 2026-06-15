
CREATE TABLE public.rentcast_cache (
  cache_key TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
GRANT ALL ON public.rentcast_cache TO service_role;
ALTER TABLE public.rentcast_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.rentcast_cache FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX rentcast_cache_expires_at_idx ON public.rentcast_cache (expires_at);

CREATE TABLE public.rentcast_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  cache_hit BOOLEAN NOT NULL DEFAULT false,
  called_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rentcast_usage_log TO authenticated;
GRANT ALL ON public.rentcast_usage_log TO service_role;
ALTER TABLE public.rentcast_usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own rentcast usage" ON public.rentcast_usage_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX rentcast_usage_log_user_called_idx ON public.rentcast_usage_log (user_id, called_at DESC);
