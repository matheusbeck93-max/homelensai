CREATE TABLE public.ai_usage_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  surface TEXT NOT NULL,
  model_id TEXT NOT NULL,
  api_name TEXT NOT NULL,
  attempt TEXT NOT NULL CHECK (attempt IN ('primary','fallback')),
  tier TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'ok',
  error_code TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  usage_date DATE NOT NULL GENERATED ALWAYS AS ((created_at AT TIME ZONE 'UTC')::date) STORED
);

CREATE INDEX idx_ai_usage_log_user_created ON public.ai_usage_log (user_id, created_at DESC);
CREATE INDEX idx_ai_usage_log_surface_created ON public.ai_usage_log (surface, created_at DESC);
CREATE INDEX idx_ai_usage_log_user_day ON public.ai_usage_log (user_id, usage_date);

GRANT SELECT ON public.ai_usage_log TO authenticated;
GRANT ALL ON public.ai_usage_log TO service_role;

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI usage"
ON public.ai_usage_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);