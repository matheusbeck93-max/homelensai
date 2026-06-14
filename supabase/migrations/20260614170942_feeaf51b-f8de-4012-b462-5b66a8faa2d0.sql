-- 1) open_house_cache: server-managed search cache
CREATE TABLE public.open_house_cache (
  filter_hash TEXT PRIMARY KEY,
  country TEXT NOT NULL,
  state TEXT,
  city TEXT,
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.open_house_cache TO authenticated;
GRANT ALL ON public.open_house_cache TO service_role;

ALTER TABLE public.open_house_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cache"
ON public.open_house_cache FOR SELECT
TO authenticated
USING (true);

-- 2) open_house_alerts: user-scoped saved alerts
CREATE TABLE public.open_house_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country TEXT NOT NULL DEFAULT 'US',
  state TEXT,
  city TEXT,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  frequency TEXT NOT NULL DEFAULT 'weekly',
  last_sent_at TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT open_house_alerts_frequency_check CHECK (frequency IN ('daily','weekly'))
);

CREATE INDEX open_house_alerts_user_id_idx ON public.open_house_alerts(user_id);
CREATE INDEX open_house_alerts_enabled_idx ON public.open_house_alerts(enabled) WHERE enabled = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.open_house_alerts TO authenticated;
GRANT ALL ON public.open_house_alerts TO service_role;

ALTER TABLE public.open_house_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own open house alerts"
ON public.open_house_alerts FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_open_house_alerts_updated_at
BEFORE UPDATE ON public.open_house_alerts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) profiles: free-tier daily counter
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_open_house_searches INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_open_house_searches_reset_at TIMESTAMPTZ;

-- 4) email_preferences: per-user digest opt-out
ALTER TABLE public.email_preferences
  ADD COLUMN IF NOT EXISTS open_house_digest BOOLEAN NOT NULL DEFAULT true;