-- 1. Backfill legacy subscription_status values to the new tier names.
UPDATE public.profiles SET subscription_status = 'buyer'    WHERE subscription_status = 'paid';
UPDATE public.profiles SET subscription_status = 'investor' WHERE subscription_status = 'premium';
UPDATE public.profiles SET subscription_status = 'free'
  WHERE subscription_status IS NULL
     OR subscription_status NOT IN ('free','buyer','investor');

-- 2. Enforce the new tier vocabulary going forward.
ALTER TABLE public.profiles
  ALTER COLUMN subscription_status SET DEFAULT 'free';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IN ('free','buyer','investor'));

-- 3. Track upgrade-CTA click → Stripe-checkout conversion.
CREATE TABLE public.upgrade_cta_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cap_session_id UUID NOT NULL,
  source TEXT NOT NULL,
  from_tier TEXT NOT NULL,
  to_tier TEXT,
  stripe_session_id TEXT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at TIMESTAMPTZ
);

CREATE INDEX idx_upgrade_cta_events_cap_session ON public.upgrade_cta_events(cap_session_id);
CREATE INDEX idx_upgrade_cta_events_user ON public.upgrade_cta_events(user_id, clicked_at DESC);

GRANT SELECT, INSERT ON public.upgrade_cta_events TO authenticated;
GRANT ALL ON public.upgrade_cta_events TO service_role;

ALTER TABLE public.upgrade_cta_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own upgrade CTA events"
ON public.upgrade_cta_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view their own upgrade CTA events"
ON public.upgrade_cta_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
