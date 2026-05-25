ALTER TABLE public.profiles DISABLE TRIGGER USER;
UPDATE public.profiles
SET subscription_status = 'investor',
    subscription_renews_at = NULL,
    subscription_cancel_at = NULL,
    updated_at = now()
WHERE id IN ('9ce41b39-23d1-4770-9095-2ecf86e84062','936faac3-9eef-48e9-8fa1-b27dd16a7b5f');
ALTER TABLE public.profiles ENABLE TRIGGER USER;