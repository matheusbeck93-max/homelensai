UPDATE public.profiles
SET subscription_status = 'premium',
    subscription_renews_at = (now() + interval '1 year'),
    subscription_cancel_at = NULL,
    ai_credits_used_today = 0,
    ai_credits_last_reset = CURRENT_DATE,
    daily_analysis_count = 0,
    daily_analysis_last_reset = CURRENT_DATE
WHERE email = 'matheusbeck93@gmail.com';