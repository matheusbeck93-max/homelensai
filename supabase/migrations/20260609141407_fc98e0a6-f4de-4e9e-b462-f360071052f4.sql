
-- 1) Trigger to prevent client (non service_role) updates to privileged profile fields
CREATE OR REPLACE FUNCTION public.prevent_privileged_profile_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow service_role (edge functions, webhooks) to update anything
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Reset privileged billing/subscription/quota fields back to OLD values
  NEW.subscription_status              := OLD.subscription_status;
  NEW.subscription_renews_at           := OLD.subscription_renews_at;
  NEW.subscription_cancel_at           := OLD.subscription_cancel_at;
  NEW.stripe_customer_id               := OLD.stripe_customer_id;
  NEW.stripe_subscription_id           := OLD.stripe_subscription_id;
  NEW.stripe_subscription_item_id      := OLD.stripe_subscription_item_id;
  NEW.stripe_price_id                  := OLD.stripe_price_id;
  NEW.plan_credits_remaining_usd       := OLD.plan_credits_remaining_usd;
  NEW.plan_credits_allowance_usd       := OLD.plan_credits_allowance_usd;
  NEW.ai_credits_used_today            := OLD.ai_credits_used_today;
  NEW.daily_analysis_count             := OLD.daily_analysis_count;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_privileged_profile_updates_trg ON public.profiles;
CREATE TRIGGER prevent_privileged_profile_updates_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_privileged_profile_updates();

-- 2) Explicit service-role-only INSERT policy on ai_usage_log for clarity.
-- Authenticated/anon clients remain implicitly denied (no policy granting them INSERT).
DROP POLICY IF EXISTS "Service role can insert usage rows" ON public.ai_usage_log;
CREATE POLICY "Service role can insert usage rows"
ON public.ai_usage_log
FOR INSERT
TO service_role
WITH CHECK (true);
