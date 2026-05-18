-- Secure subscription columns against client tampering.
--
-- BACKGROUND
-- The existing UPDATE policy on profiles was:
--   USING (auth.uid() = id)
-- with no WITH CHECK clause and no column-level protection. That meant any
-- authenticated user could run:
--   await supabase.from('profiles').update({ subscription_status: 'premium' }).eq('id', myId)
-- and grant themselves Premium access without going through Stripe. The
-- frontend reads `profiles.subscription_status` directly to gate Premium
-- features, so this was an immediate revenue bypass.
--
-- FIX
-- A row-level trigger that blocks any UPDATE which changes the subscription_*
-- columns unless the caller is the service_role (used by edge functions like
-- check-subscription, manage-subscription, and the future stripe-webhook).
-- Regular authenticated users can still UPDATE their own profile rows for
-- name/preferences/etc., but the trigger raises if they touch subscription
-- columns.

CREATE OR REPLACE FUNCTION public.prevent_subscription_tamper()
RETURNS TRIGGER AS $$
BEGIN
  -- Service role bypasses the trigger. Edge functions using the service
  -- role key set request.jwt.claim.role = 'service_role' automatically.
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Block writes that change any subscription column.
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
  'Blocks non-service-role UPDATEs that change subscription_status, subscription_renews_at, or subscription_cancel_at. Closes the revenue-bypass vector where any authenticated user could grant themselves Premium by writing to their own profile row.';

-- Also tighten the existing UPDATE policy with an explicit WITH CHECK so the
-- intent is documented at the policy level (the trigger is the actual enforcer).
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
