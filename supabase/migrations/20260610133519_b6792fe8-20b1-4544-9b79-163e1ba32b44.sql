
REVOKE ALL ON public.v_user_usage_daily FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.v_user_usage_daily TO service_role;
