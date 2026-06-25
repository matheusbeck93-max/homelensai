CREATE OR REPLACE FUNCTION public.prevent_privileged_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW.is_staff                         := OLD.is_staff;
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
$function$;