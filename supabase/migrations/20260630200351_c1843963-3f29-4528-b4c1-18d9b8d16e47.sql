
-- 1. blog-covers: remove anon from SELECT policy (keep authenticated)
DROP POLICY IF EXISTS "Authenticated can read blog covers" ON storage.objects;
CREATE POLICY "Authenticated can read blog covers"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'blog-covers');

-- 2. email_send_log: revoke recipient_email column SELECT from client roles
REVOKE SELECT (recipient_email) ON public.email_send_log FROM authenticated, anon;

-- 3. profiles: revoke client UPDATE on privileged columns (defense-in-depth in addition to trigger)
REVOKE UPDATE (
  is_staff,
  subscription_status,
  subscription_renews_at,
  subscription_cancel_at,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_subscription_item_id,
  stripe_price_id
) ON public.profiles FROM authenticated, anon;

-- 4. profiles: revoke client SELECT on stripe billing identifiers
REVOKE SELECT (
  stripe_customer_id,
  stripe_subscription_id,
  stripe_subscription_item_id,
  stripe_price_id
) ON public.profiles FROM authenticated, anon;
