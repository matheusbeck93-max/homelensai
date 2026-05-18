-- Drop the unused 'pro' value from subscription_status CHECK constraint.
--
-- BACKGROUND
-- Migration 20251123205602 created subscription_status with
--   CHECK (subscription_status IN ('free', 'pro', 'premium'))
-- but the frontend SubscriptionTier is only 'free' | 'premium' and no code
-- path ever assigns 'pro'. The presence of a third allowed value with no
-- defined behavior is a footgun: anything that ever sets it would cast past
-- the TypeScript type check and produce undefined behavior in hasFeatureAccess.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IN ('free', 'premium'));

COMMENT ON COLUMN public.profiles.subscription_status IS
  'User subscription tier: free or premium. Modified only by service-role callers (Stripe webhook, check-subscription) — enforced by prevent_subscription_tamper trigger.';
