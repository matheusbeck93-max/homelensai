CREATE TABLE public.ai_credit_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  function_name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('precheck','deduct','reset','block')),
  credits_charged INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  balance_before INTEGER,
  balance_after INTEGER,
  model TEXT,
  request_id TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_credit_ledger_user_created
  ON public.ai_credit_ledger (user_id, created_at DESC);

ALTER TABLE public.ai_credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credit ledger"
  ON public.ai_credit_ledger
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert credit ledger entries"
  ON public.ai_credit_ledger
  FOR INSERT
  TO service_role
  WITH CHECK (true);