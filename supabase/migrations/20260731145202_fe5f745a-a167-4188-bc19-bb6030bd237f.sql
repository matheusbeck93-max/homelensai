CREATE OR REPLACE FUNCTION public.prevent_privileged_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role'
     OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW.is_staff                         := OLD.is_staff;
  NEW.subscription_status              := OLD.subscription_status;
  NEW.subscription_renews_at           := OLD.subscription_renews_at;
  NEW.subscription_cancel_at           := OLD.subscription_cancel_at;
  NEW.current_period_start             := OLD.current_period_start;
  NEW.current_period_end               := OLD.current_period_end;
  NEW.trial_used_at                    := OLD.trial_used_at;
  NEW.stripe_customer_id               := OLD.stripe_customer_id;
  NEW.stripe_subscription_id           := OLD.stripe_subscription_id;
  NEW.stripe_subscription_item_id      := OLD.stripe_subscription_item_id;
  NEW.stripe_price_id                  := OLD.stripe_price_id;
  NEW.plan_credits_remaining_usd       := OLD.plan_credits_remaining_usd;
  NEW.plan_credits_allowance_usd       := OLD.plan_credits_allowance_usd;
  NEW.ai_credits_used_today            := OLD.ai_credits_used_today;
  NEW.ai_credits_last_reset            := OLD.ai_credits_last_reset;
  NEW.daily_analysis_count             := OLD.daily_analysis_count;
  NEW.daily_analysis_last_reset        := OLD.daily_analysis_last_reset;
  NEW.daily_open_house_searches        := OLD.daily_open_house_searches;
  NEW.daily_open_house_searches_reset_at := OLD.daily_open_house_searches_reset_at;
  NEW.monthly_briefs_count             := OLD.monthly_briefs_count;
  NEW.monthly_chat_count               := OLD.monthly_chat_count;
  NEW.monthly_photos_count             := OLD.monthly_photos_count;
  NEW.monthly_quota_reset_date         := OLD.monthly_quota_reset_date;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_privileged_profile_updates_trg ON public.profiles;
CREATE TRIGGER prevent_privileged_profile_updates_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_privileged_profile_updates();