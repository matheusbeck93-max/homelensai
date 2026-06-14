
-- Streak tracking per user
CREATE TABLE IF NOT EXISTS public.user_engagement_streaks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_current integer NOT NULL DEFAULT 0,
  daily_longest integer NOT NULL DEFAULT 0,
  last_engagement_date date,
  current_week_start date,
  weekly_skip_used boolean NOT NULL DEFAULT false,
  highest_milestone_reached integer NOT NULL DEFAULT 0,
  total_actions integer NOT NULL DEFAULT 0,
  last_action text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.user_engagement_streaks TO authenticated;
GRANT ALL ON public.user_engagement_streaks TO service_role;

ALTER TABLE public.user_engagement_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own streak"
  ON public.user_engagement_streaks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own streak prefs"
  ON public.user_engagement_streaks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_user_engagement_streaks_updated
  BEFORE UPDATE ON public.user_engagement_streaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Opt-out flag on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS streak_tracking_disabled boolean NOT NULL DEFAULT false;
