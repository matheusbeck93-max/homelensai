
CREATE TABLE IF NOT EXISTS public.state_tax_cache (
  state_code TEXT PRIMARY KEY,
  rate NUMERIC(5,2) NOT NULL,
  source TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.state_tax_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on state_tax_cache" ON public.state_tax_cache
  FOR SELECT USING (true);

CREATE POLICY "Allow service role write on state_tax_cache" ON public.state_tax_cache
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Allow service role update on state_tax_cache" ON public.state_tax_cache
  FOR UPDATE TO service_role USING (true);
