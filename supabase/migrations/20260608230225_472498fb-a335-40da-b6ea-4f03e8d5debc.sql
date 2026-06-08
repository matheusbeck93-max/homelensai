
-- 1. subscription_plans lookup table
CREATE TABLE public.subscription_plans (
  tier TEXT PRIMARY KEY CHECK (tier IN ('buyer', 'investor')),
  stripe_price_id_monthly TEXT,
  stripe_price_id_annual TEXT,
  monthly_credit_allowance_usd NUMERIC(10,4),
  trial_days INTEGER NOT NULL DEFAULT 7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_plans_read_all"
  ON public.subscription_plans FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER subscription_plans_set_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed rows; price IDs to be filled by product config (env-driven elsewhere).
INSERT INTO public.subscription_plans (tier, trial_days) VALUES
  ('buyer', 7),
  ('investor', 7);

-- 2. profiles columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_credits_remaining_usd NUMERIC(10,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plan_credits_allowance_usd NUMERIC(10,4) NOT NULL DEFAULT 0;

-- 3. user_credits.source + widen pack_size
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'topup';

ALTER TABLE public.user_credits
  DROP CONSTRAINT IF EXISTS user_credits_pack_size_check;
ALTER TABLE public.user_credits
  ADD CONSTRAINT user_credits_pack_size_check
  CHECK (pack_size IN ('small', 'medium', 'large', 'plan_grant'));

ALTER TABLE public.user_credits
  ADD CONSTRAINT user_credits_source_check
  CHECK (source IN ('topup', 'plan'));

-- 4. topup_events.event_type widen
DO $$
DECLARE conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'topup_events'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%event_type%';
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.topup_events DROP CONSTRAINT %I', conname);
  END IF;
END$$;

ALTER TABLE public.topup_events
  ADD CONSTRAINT topup_events_event_type_check
  CHECK (event_type IN (
    'initiated', 'completed', 'failed', 'refunded',
    'consumed', 'expired', 'plan_granted', 'plan_reset'
  ));
