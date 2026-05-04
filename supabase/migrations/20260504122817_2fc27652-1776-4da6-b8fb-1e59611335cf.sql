UPDATE public.profiles
SET subscription_status = 'premium',
    subscription_renews_at = now() + interval '30 days',
    subscription_cancel_at = NULL
WHERE email = 'matheusbeck93@gmail.com';