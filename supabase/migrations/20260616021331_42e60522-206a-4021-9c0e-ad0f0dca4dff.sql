
CREATE TABLE IF NOT EXISTS public.fred_cache (
  series_id text PRIMARY KEY,
  payload jsonb NOT NULL,
  cached_at timestamptz NOT NULL DEFAULT now(),
  ttl_minutes integer NOT NULL DEFAULT 1440
);

GRANT ALL ON public.fred_cache TO service_role;

ALTER TABLE public.fred_cache ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_fred_cache_cached_at ON public.fred_cache (cached_at);
