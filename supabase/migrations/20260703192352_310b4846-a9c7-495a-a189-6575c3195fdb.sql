
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE TABLE IF NOT EXISTS public.ai_debug_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  surface TEXT NOT NULL,
  model_id TEXT NOT NULL,
  api_name TEXT NOT NULL,
  tier TEXT,
  request_body JSONB,
  response_text TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cache_read_input_tokens INTEGER,
  cache_creation_input_tokens INTEGER,
  status TEXT,
  latency_ms INTEGER,
  provider_request_id TEXT,
  error_message TEXT,
  is_dev_call BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.ai_debug_requests TO service_role;
ALTER TABLE public.ai_debug_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role manages ai_debug_requests"
  ON public.ai_debug_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS ai_debug_requests_created_at_idx
  ON public.ai_debug_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_debug_requests_surface_idx
  ON public.ai_debug_requests (surface, created_at DESC);
