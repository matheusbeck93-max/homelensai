
CREATE TABLE public.mcp_usage_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tool_name text NOT NULL,
  tier_at_call text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('ok','gated','error')),
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mcp_usage_log_user_created_idx ON public.mcp_usage_log (user_id, created_at DESC);
CREATE INDEX mcp_usage_log_tool_created_idx ON public.mcp_usage_log (tool_name, created_at DESC);

GRANT SELECT ON public.mcp_usage_log TO authenticated;
GRANT ALL ON public.mcp_usage_log TO service_role;

ALTER TABLE public.mcp_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own MCP usage"
  ON public.mcp_usage_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
