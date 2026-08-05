REVOKE UPDATE ON public.profiles FROM authenticated;

GRANT UPDATE (
  full_name, updated_at, user_profile, budget_min, budget_max, desired_monthly_payment,
  location_preferences, property_types, risk_level, buyer_type, commute_preferences,
  onboarding_completed, alert_price_drops, alert_status_changes, alert_email_enabled,
  weekly_picks_enabled, weekly_picks_day, preferred_cities, max_price_range, min_bedrooms,
  primary_goal, investment_strategy, hold_period_years, financing_preference, min_bathrooms,
  must_have_features, has_children, children_ages, climate_preference, safety_priority,
  about_me, buyer_types, investment_strategies, financing_preferences, min_sqft, max_sqft,
  preferences, brief_cadence, brief_card_count, cash_available, financing_defaults,
  persona, persona_secondary, persona_set_at, target_cap_rate,
  extension_smart_suggestions_enabled, timezone, streak_tracking_disabled
) ON public.profiles TO authenticated;

GRANT ALL ON public.profiles TO service_role;

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

  NEW.id                               := OLD.id;
  NEW.email                            := OLD.email;
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
  NEW.weekly_picks_last_sent           := OLD.weekly_picks_last_sent;

  RETURN NEW;
END;
$function$;