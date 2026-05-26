
-- Persona columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS persona text
    CHECK (persona IN ('first_time_buyer','rental_investor','flipper','institutional','mixed'))
    DEFAULT 'mixed',
  ADD COLUMN IF NOT EXISTS persona_secondary text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS persona_set_at timestamptz;

-- Telemetry table for persona-aware tool/brief events
CREATE TABLE IF NOT EXISTS public.investor_persona_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  persona text,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.investor_persona_telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own persona telemetry"
  ON public.investor_persona_telemetry
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own persona telemetry"
  ON public.investor_persona_telemetry
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can write persona telemetry"
  ON public.investor_persona_telemetry
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_investor_persona_telemetry_user_created
  ON public.investor_persona_telemetry(user_id, created_at DESC);
