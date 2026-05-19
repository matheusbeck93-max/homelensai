CREATE OR REPLACE FUNCTION public.prevent_subscription_tamper()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status OR
     NEW.subscription_renews_at IS DISTINCT FROM OLD.subscription_renews_at OR
     NEW.subscription_cancel_at IS DISTINCT FROM OLD.subscription_cancel_at THEN
    RAISE EXCEPTION 'Subscription fields can only be modified by Stripe webhooks (service role).'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS prevent_subscription_tamper_trigger ON public.profiles;

CREATE TRIGGER prevent_subscription_tamper_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_subscription_tamper();

COMMENT ON FUNCTION public.prevent_subscription_tamper IS
  'Blocks non-service-role UPDATEs that change subscription_status, subscription_renews_at, or subscription_cancel_at.';

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Normalize any stray 'pro' values before tightening the constraint.
UPDATE public.profiles SET subscription_status = 'free' WHERE subscription_status NOT IN ('free', 'premium');

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IN ('free', 'premium'));

COMMENT ON COLUMN public.profiles.subscription_status IS
  'User subscription tier: free or premium. Modified only by service-role callers (Stripe webhook, check-subscription) — enforced by prevent_subscription_tamper trigger.';