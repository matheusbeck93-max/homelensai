-- delivered_milestones: tracks milestone events surfaced to users
CREATE TABLE public.delivered_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone_id text NOT NULL,
  subject_id text NOT NULL DEFAULT '',
  category text NOT NULL,
  severity text NOT NULL DEFAULT 'notable',
  headline text NOT NULL,
  context text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  delivered_in_app boolean NOT NULL DEFAULT false,
  delivered_via_email boolean NOT NULL DEFAULT false,
  acknowledged_at timestamptz,
  shared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivered_milestones_unique UNIQUE (user_id, milestone_id, subject_id),
  CONSTRAINT delivered_milestones_severity_check CHECK (severity IN ('minor','notable','major')),
  CONSTRAINT delivered_milestones_category_check CHECK (category IN ('property','saved','account','market','streak'))
);

GRANT SELECT, UPDATE ON public.delivered_milestones TO authenticated;
GRANT ALL ON public.delivered_milestones TO service_role;

ALTER TABLE public.delivered_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own milestones"
  ON public.delivered_milestones FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own milestones"
  ON public.delivered_milestones FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX delivered_milestones_user_pending_idx
  ON public.delivered_milestones (user_id, acknowledged_at)
  WHERE acknowledged_at IS NULL;

CREATE INDEX delivered_milestones_user_detected_idx
  ON public.delivered_milestones (user_id, detected_at DESC);

CREATE TRIGGER update_delivered_milestones_updated_at
  BEFORE UPDATE ON public.delivered_milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- profiles.timezone for user-local cron scheduling
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/New_York';