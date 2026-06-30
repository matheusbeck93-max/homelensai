
ALTER TABLE public.ai_usage_log
  ADD COLUMN IF NOT EXISTS cache_read_input_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_creation_input_tokens integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.cron_run_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  duration_ms integer,
  status text NOT NULL DEFAULT 'ok',
  ai_cost_usd numeric(10,6) NOT NULL DEFAULT 0,
  triggered_by text NOT NULL DEFAULT 'schedule' CHECK (triggered_by IN ('schedule','manual')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_run_log_job_ran ON public.cron_run_log(job_name, ran_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_run_log_ran ON public.cron_run_log(ran_at DESC);

GRANT SELECT ON public.cron_run_log TO authenticated;
GRANT ALL ON public.cron_run_log TO service_role;

ALTER TABLE public.cron_run_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read cron run log"
  ON public.cron_run_log
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_staff = true));

CREATE POLICY "Service role manages cron run log"
  ON public.cron_run_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
