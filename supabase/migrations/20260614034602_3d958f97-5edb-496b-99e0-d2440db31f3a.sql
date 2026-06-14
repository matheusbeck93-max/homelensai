
-- Artifacts table: one row per generated file (PDF, XLSX, chart image, etc.)
CREATE TABLE public.artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('mortgage_excel','purchase_plan_pdf','property_report_pdf','chart_image')),
  filename text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','error')),
  error text,
  surface text,
  source_thread_id uuid,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.artifacts TO authenticated;
GRANT ALL ON public.artifacts TO service_role;

ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own artifacts"
  ON public.artifacts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own artifacts"
  ON public.artifacts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own artifacts"
  ON public.artifacts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX artifacts_user_created_idx
  ON public.artifacts (user_id, created_at DESC);

CREATE TRIGGER artifacts_set_updated_at
  BEFORE UPDATE ON public.artifacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-day artifact cost/count log, scoped per user+kind+day.
CREATE TABLE public.artifact_generation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  count integer NOT NULL DEFAULT 0,
  total_cost_usd numeric(10,4) NOT NULL DEFAULT 0,
  total_input_tokens integer NOT NULL DEFAULT 0,
  total_output_tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, day)
);

GRANT SELECT ON public.artifact_generation_log TO authenticated;
GRANT ALL ON public.artifact_generation_log TO service_role;

ALTER TABLE public.artifact_generation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own artifact log"
  ON public.artifact_generation_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX artifact_log_user_day_idx
  ON public.artifact_generation_log (user_id, day DESC);

CREATE TRIGGER artifact_log_set_updated_at
  BEFORE UPDATE ON public.artifact_generation_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
