-- 1) subscription_plans: restrict SELECT to authenticated; drop anon access
DROP POLICY IF EXISTS "Public can view subscription plans" ON public.subscription_plans;
REVOKE SELECT ON public.subscription_plans FROM anon;
GRANT SELECT ON public.subscription_plans TO authenticated;
CREATE POLICY "Authenticated users can view subscription plans"
  ON public.subscription_plans
  FOR SELECT
  TO authenticated
  USING (true);

-- 2) fred_cache: server-only cache. Add an explicit deny policy so the
--    Supabase linter stops flagging "RLS enabled, no policy". service_role
--    bypasses RLS so backend prefetch/read paths are unaffected.
REVOKE ALL ON public.fred_cache FROM anon, authenticated;
GRANT ALL ON public.fred_cache TO service_role;
CREATE POLICY "Deny direct client access to fred_cache"
  ON public.fred_cache
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);