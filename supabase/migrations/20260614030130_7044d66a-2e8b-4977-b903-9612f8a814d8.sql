
-- 1. Profile additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS target_cap_rate numeric,
  ADD COLUMN IF NOT EXISTS extension_smart_suggestions_enabled boolean NOT NULL DEFAULT true;

-- 2. user_exception_properties
CREATE TABLE public.user_exception_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_url text NOT NULL,
  listing_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, property_url)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_exception_properties TO authenticated;
GRANT ALL ON public.user_exception_properties TO service_role;

ALTER TABLE public.user_exception_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own exception properties"
  ON public.user_exception_properties FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own exception properties"
  ON public.user_exception_properties FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own exception properties"
  ON public.user_exception_properties FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own exception properties"
  ON public.user_exception_properties FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER user_exception_properties_updated_at
  BEFORE UPDATE ON public.user_exception_properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_exception_properties;

-- 3. preference_followup_dismissals
CREATE TABLE public.preference_followup_dismissals (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mismatch_type text NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, mismatch_type, dismissed_at)
);

CREATE INDEX preference_followup_dismissals_user_type_idx
  ON public.preference_followup_dismissals (user_id, mismatch_type, dismissed_at DESC);

GRANT SELECT, INSERT, DELETE ON public.preference_followup_dismissals TO authenticated;
GRANT ALL ON public.preference_followup_dismissals TO service_role;

ALTER TABLE public.preference_followup_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own dismissals"
  ON public.preference_followup_dismissals FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own dismissals"
  ON public.preference_followup_dismissals FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own dismissals"
  ON public.preference_followup_dismissals FOR DELETE
  USING (auth.uid() = user_id);
