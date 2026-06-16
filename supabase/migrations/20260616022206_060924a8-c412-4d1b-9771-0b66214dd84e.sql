CREATE TABLE public.census_cache (
  cache_key TEXT NOT NULL PRIMARY KEY,
  payload JSONB NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ttl_minutes INTEGER NOT NULL DEFAULT 10080
);

GRANT ALL ON public.census_cache TO service_role;

ALTER TABLE public.census_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role only"
  ON public.census_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX census_cache_cached_at_idx ON public.census_cache (cached_at);