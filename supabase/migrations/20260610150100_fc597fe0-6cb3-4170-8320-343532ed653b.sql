
ALTER FUNCTION public.set_iop_alert_user_id() SECURITY INVOKER;
ALTER FUNCTION public.set_iop_doc_user_id() SECURITY INVOKER;
REVOKE EXECUTE ON FUNCTION public.set_iop_alert_user_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_iop_doc_user_id() FROM PUBLIC, anon, authenticated;
