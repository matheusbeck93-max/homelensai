CREATE TABLE public.ci_web_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  surface text NOT NULL,
  props jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT INSERT ON public.ci_web_events TO authenticated;
GRANT ALL ON public.ci_web_events TO service_role;

ALTER TABLE public.ci_web_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own ci events"
  ON public.ci_web_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access"
  ON public.ci_web_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_ci_web_events_user_created ON public.ci_web_events (user_id, created_at DESC);
CREATE INDEX idx_ci_web_events_event_created ON public.ci_web_events (event_name, created_at DESC);