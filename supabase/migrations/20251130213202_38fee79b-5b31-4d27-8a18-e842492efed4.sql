-- Create search_cache table for caching property search results
CREATE TABLE IF NOT EXISTS public.search_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  normalized_query TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL,
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  ttl_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index on normalized_query for fast lookups
CREATE INDEX IF NOT EXISTS idx_search_cache_normalized_query ON public.search_cache(normalized_query);
CREATE INDEX IF NOT EXISTS idx_search_cache_created_at ON public.search_cache(created_at);

-- Create market_snapshots table for location-level market data
CREATE TABLE IF NOT EXISTS public.market_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_key TEXT NOT NULL UNIQUE,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index on location_key for fast lookups
CREATE INDEX IF NOT EXISTS idx_market_snapshots_location_key ON public.market_snapshots(location_key);

-- Enable RLS on search_cache (public read, system write)
ALTER TABLE public.search_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Search cache is viewable by everyone"
  ON public.search_cache FOR SELECT
  USING (true);

CREATE POLICY "System can insert search cache"
  ON public.search_cache FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update search cache"
  ON public.search_cache FOR UPDATE
  USING (true);

-- Enable RLS on market_snapshots (public read, system write)
ALTER TABLE public.market_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Market snapshots are viewable by everyone"
  ON public.market_snapshots FOR SELECT
  USING (true);

CREATE POLICY "System can insert market snapshots"
  ON public.market_snapshots FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update market snapshots"
  ON public.market_snapshots FOR UPDATE
  USING (true);

-- Create update trigger for search_cache
CREATE TRIGGER update_search_cache_updated_at
  BEFORE UPDATE ON public.search_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create update trigger for market_snapshots
CREATE TRIGGER update_market_snapshots_updated_at
  BEFORE UPDATE ON public.market_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();