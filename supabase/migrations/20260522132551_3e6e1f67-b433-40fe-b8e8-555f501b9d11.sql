BEGIN;

-- Migrate existing 'premium' rows to 'buyer' BEFORE changing the constraint
UPDATE public.profiles SET subscription_status = 'buyer' WHERE subscription_status = 'premium';

-- Drop the old constraint (if it exists) and add the new one
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IN ('free', 'buyer', 'investor'));

COMMENT ON COLUMN public.profiles.subscription_status IS
  'User subscription tier: free, buyer, or investor. Modified only by Stripe webhook (service role) - enforced by prevent_subscription_tamper trigger.';

COMMIT;