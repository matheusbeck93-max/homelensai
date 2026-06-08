-- Top-up credits: per-user one-time AI credit packs purchased via Stripe.
CREATE TABLE public.user_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_usd numeric(8,4) NOT NULL CHECK (amount_usd > 0),
  consumed_usd numeric(8,4) NOT NULL DEFAULT 0 CHECK (consumed_usd >= 0),
  pack_size text NOT NULL CHECK (pack_size IN ('small','medium','large')),
  stripe_session_id text NOT NULL UNIQUE,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','exhausted','expired','refunded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_credits_user_active_idx
  ON public.user_credits(user_id, status, expires_at, purchased_at);

GRANT SELECT ON public.user_credits TO authenticated;
GRANT ALL ON public.user_credits TO service_role;

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_credits_owner_select
  ON public.user_credits
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Inserts and updates are done by the service role only (Stripe webhook
-- and the budget guard's consumption path). No client-facing write policy.

CREATE TRIGGER user_credits_set_updated_at
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Top-up telemetry: separate from upgrade_cta_events so the funnels stay
-- clean. One row per lifecycle event (offered/clicked/completed/consumed/expired).
CREATE TABLE public.topup_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('offered','pack_clicked','completed','consumed','expired')),
  pack_size text CHECK (pack_size IN ('small','medium','large')),
  surface text,
  tier text,
  price_usd numeric(8,4),
  credit_usd numeric(8,4),
  remaining_balance_usd numeric(8,4),
  stripe_session_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX topup_events_user_idx ON public.topup_events(user_id, created_at DESC);
CREATE INDEX topup_events_type_idx ON public.topup_events(event_type, created_at DESC);

GRANT SELECT ON public.topup_events TO authenticated;
GRANT ALL ON public.topup_events TO service_role;

ALTER TABLE public.topup_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY topup_events_owner_select
  ON public.topup_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);