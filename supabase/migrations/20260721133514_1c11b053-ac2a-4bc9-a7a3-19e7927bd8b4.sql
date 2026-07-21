
-- Restrict property_vectors to service_role only (embeddings are internal)
DROP POLICY IF EXISTS "Authenticated users can view property vectors" ON public.property_vectors;
REVOKE ALL ON public.property_vectors FROM anon, authenticated;
GRANT ALL ON public.property_vectors TO service_role;
CREATE POLICY "Service role manages property vectors"
  ON public.property_vectors FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Add deny-by-default policy on realtime.messages for private channels/broadcast/presence
-- The app currently only uses postgres_changes on public tables (no private channels),
-- so blocking realtime.messages access is safe and prevents future misuse.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='realtime' AND tablename='messages') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Deny all realtime broadcast/presence" ON realtime.messages';
    EXECUTE 'CREATE POLICY "Deny all realtime broadcast/presence" ON realtime.messages FOR ALL TO authenticated, anon USING (false) WITH CHECK (false)';
  END IF;
END $$;
