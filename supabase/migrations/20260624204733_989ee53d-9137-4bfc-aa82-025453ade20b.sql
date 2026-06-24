
-- 1. Attach existing trigger to protect privileged columns on profiles
DROP TRIGGER IF EXISTS prevent_privileged_profile_updates_trg ON public.profiles;
CREATE TRIGGER prevent_privileged_profile_updates_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privileged_profile_updates();

-- 2. Restrictive deny policies on legacy_upgrade_nudges for authenticated writes
DROP POLICY IF EXISTS "Deny authenticated insert on legacy_upgrade_nudges" ON public.legacy_upgrade_nudges;
CREATE POLICY "Deny authenticated insert on legacy_upgrade_nudges"
  ON public.legacy_upgrade_nudges
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny authenticated update on legacy_upgrade_nudges" ON public.legacy_upgrade_nudges;
CREATE POLICY "Deny authenticated update on legacy_upgrade_nudges"
  ON public.legacy_upgrade_nudges
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny authenticated delete on legacy_upgrade_nudges" ON public.legacy_upgrade_nudges;
CREATE POLICY "Deny authenticated delete on legacy_upgrade_nudges"
  ON public.legacy_upgrade_nudges
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (false);

-- 3. Restrictive deny policies on topup_events for authenticated writes
DROP POLICY IF EXISTS "Deny authenticated insert on topup_events" ON public.topup_events;
CREATE POLICY "Deny authenticated insert on topup_events"
  ON public.topup_events
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny authenticated update on topup_events" ON public.topup_events;
CREATE POLICY "Deny authenticated update on topup_events"
  ON public.topup_events
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny authenticated delete on topup_events" ON public.topup_events;
CREATE POLICY "Deny authenticated delete on topup_events"
  ON public.topup_events
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (false);
