
-- 1) Track legacy subscriber nudge interactions
CREATE TABLE public.legacy_upgrade_nudges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  legacy_price_id TEXT NOT NULL,
  current_tier TEXT NOT NULL,
  shown_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  deferred_until TIMESTAMPTZ,
  new_stripe_session_id TEXT,
  upgrade_completed_at TIMESTAMPTZ,
  surface TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.legacy_upgrade_nudges TO authenticated;
GRANT ALL ON public.legacy_upgrade_nudges TO service_role;

ALTER TABLE public.legacy_upgrade_nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own legacy nudges"
ON public.legacy_upgrade_nudges
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own legacy nudges"
ON public.legacy_upgrade_nudges
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own legacy nudges"
ON public.legacy_upgrade_nudges
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own legacy nudges"
ON public.legacy_upgrade_nudges
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX lun_user_idx ON public.legacy_upgrade_nudges(user_id, shown_at DESC);

CREATE TRIGGER update_legacy_upgrade_nudges_updated_at
BEFORE UPDATE ON public.legacy_upgrade_nudges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Capture Stripe price/subscription identifiers on profile so we can detect legacy pricing
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_item_id TEXT;
