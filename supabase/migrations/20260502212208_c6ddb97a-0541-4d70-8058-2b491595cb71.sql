CREATE TABLE IF NOT EXISTS public.saved_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_url TEXT,
  property_address TEXT,
  property_price NUMERIC,
  analysis_summary TEXT NOT NULL,
  investment_score INTEGER,
  score_label TEXT,
  key_metrics JSONB,
  source TEXT NOT NULL DEFAULT 'app',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_analyses_user
  ON public.saved_analyses (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_analyses_user_url_unique
  ON public.saved_analyses (user_id, property_url)
  WHERE property_url IS NOT NULL;

ALTER TABLE public.saved_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved analyses"
  ON public.saved_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved analyses"
  ON public.saved_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved analyses"
  ON public.saved_analyses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved analyses"
  ON public.saved_analyses FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_saved_analyses_updated_at
  BEFORE UPDATE ON public.saved_analyses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();