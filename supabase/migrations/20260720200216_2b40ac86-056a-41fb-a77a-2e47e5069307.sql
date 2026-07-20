
-- Attach privileged-columns guard trigger to profiles
DROP TRIGGER IF EXISTS prevent_privileged_profile_updates_trg ON public.profiles;
CREATE TRIGGER prevent_privileged_profile_updates_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privileged_profile_updates();

-- Lock down state_tax_cache to service_role only (align with other cache tables)
DROP POLICY IF EXISTS "Allow public read on state_tax_cache" ON public.state_tax_cache;
REVOKE SELECT ON public.state_tax_cache FROM anon, authenticated;

CREATE POLICY "Service role read on state_tax_cache"
  ON public.state_tax_cache
  FOR SELECT
  TO service_role
  USING (true);
