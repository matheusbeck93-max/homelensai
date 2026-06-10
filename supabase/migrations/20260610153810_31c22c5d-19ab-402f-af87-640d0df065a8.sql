-- Revoke column-level UPDATE on privileged billing/quota fields from authenticated.
-- The prevent_privileged_profile_updates trigger already resets these,
-- this adds column-level grant enforcement as defense in depth.

REVOKE UPDATE (
  subscription_status,
  subscription_renews_at,
  subscription_cancel_at,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_subscription_item_id,
  stripe_price_id,
  plan_credits_remaining_usd,
  plan_credits_allowance_usd,
  ai_credits_used_today,
  daily_analysis_count
) ON public.profiles FROM authenticated, anon, PUBLIC;
