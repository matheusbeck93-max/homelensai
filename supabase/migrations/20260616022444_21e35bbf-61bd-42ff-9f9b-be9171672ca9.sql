CREATE TABLE public.bls_cache (
  cache_key TEXT NOT NULL PRIMARY KEY,
  payload JSONB NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ttl_minutes INTEGER NOT NULL DEFAULT 1440
);

GRANT ALL ON public.bls_cache TO service_role;

ALTER TABLE public.bls_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role only"
  ON public.bls_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX bls_cache_cached_at_idx ON public.bls_cache (cached_at);