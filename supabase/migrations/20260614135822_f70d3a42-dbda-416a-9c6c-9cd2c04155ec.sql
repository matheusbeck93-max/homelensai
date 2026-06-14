
-- ============================================================
-- email_preferences
-- ============================================================
CREATE TABLE public.email_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  milestone_celebrations_enabled boolean NOT NULL DEFAULT true,
  streak_reminders_enabled boolean NOT NULL DEFAULT true,
  weekly_review_nudges_enabled boolean NOT NULL DEFAULT true,
  memory_tracking_enabled boolean NOT NULL DEFAULT true,
  digest_frequency text NOT NULL DEFAULT 'weekly' CHECK (digest_frequency IN ('off','weekly','monthly')),
  quiet_hours_start time,
  quiet_hours_end time,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.email_preferences TO authenticated;
GRANT ALL ON public.email_preferences TO service_role;

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own email prefs"
  ON public.email_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own email prefs"
  ON public.email_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own email prefs"
  ON public.email_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_email_prefs_updated
  BEFORE UPDATE ON public.email_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Default-row creator on profile insert
CREATE OR REPLACE FUNCTION public.create_default_email_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.email_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_create_email_prefs
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_default_email_preferences();

-- Backfill existing profiles
INSERT INTO public.email_preferences (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- email_send_log
-- ============================================================
CREATE TABLE public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  template text NOT NULL,
  recipient_email text NOT NULL,
  message_id text,
  idempotency_key text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed','bounced','complained','suppressed','skipped_prefs')),
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX email_send_log_idempotency_idx
  ON public.email_send_log (user_id, template, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX email_send_log_user_idx ON public.email_send_log (user_id, created_at DESC);
CREATE INDEX email_send_log_message_idx ON public.email_send_log (message_id) WHERE message_id IS NOT NULL;

GRANT SELECT ON public.email_send_log TO authenticated;
GRANT ALL ON public.email_send_log TO service_role;

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own email send log"
  ON public.email_send_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_email_send_log_updated
  BEFORE UPDATE ON public.email_send_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- email_suppression
-- ============================================================
CREATE TABLE public.email_suppression (
  email text PRIMARY KEY,
  reason text NOT NULL CHECK (reason IN ('bounce','complaint','unsubscribe','manual')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.email_suppression TO service_role;

ALTER TABLE public.email_suppression ENABLE ROW LEVEL SECURITY;
-- No user policies — service role only.

-- ============================================================
-- email_unsubscribe_tokens
-- ============================================================
CREATE TABLE public.email_unsubscribe_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);

CREATE INDEX email_unsubscribe_tokens_user_idx ON public.email_unsubscribe_tokens (user_id);

GRANT ALL ON public.email_unsubscribe_tokens TO service_role;

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
-- No user policies — service role only.
