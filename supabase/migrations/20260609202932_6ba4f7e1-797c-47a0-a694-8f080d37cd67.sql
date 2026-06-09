-- Restrict subscription_plans SELECT to service_role only (Stripe price IDs no longer exposed to client)
DROP POLICY IF EXISTS "subscription_plans_read_all" ON public.subscription_plans;
REVOKE SELECT ON public.subscription_plans FROM authenticated, anon;
-- service_role retains ALL via existing GRANT

-- Defense-in-depth: column-level UPDATE privileges on profiles.
-- Revoke broad UPDATE from authenticated, then grant only on user-editable columns.
-- Service role still has full access for webhooks/edge functions.
REVOKE UPDATE ON public.profiles FROM authenticated;

GRANT UPDATE (
  full_name,
  updated_at,
  user_profile,
  budget_min,
  budget_max,
  desired_monthly_payment,
  location_preferences,
  property_types,
  risk_level,
  buyer_type,
  commute_preferences,
  onboarding_completed,
  alert_price_drops,
  alert_status_changes,
  alert_email_enabled,
  weekly_picks_enabled,
  weekly_picks_day,
  weekly_picks_last_sent,
  preferred_cities,
  max_price_range,
  min_bedrooms,
  primary_goal,
  investment_strategy,
  hold_period_years,
  financing_preference,
  min_bathrooms,
  must_have_features,
  has_children,
  children_ages,
  climate_preference,
  safety_priority,
  about_me,
  buyer_types,
  investment_strategies,
  financing_preferences,
  min_sqft,
  max_sqft,
  preferences,
  brief_cadence,
  brief_card_count,
  cash_available,
  financing_defaults,
  persona,
  persona_secondary,
  persona_set_at
) ON public.profiles TO authenticated;