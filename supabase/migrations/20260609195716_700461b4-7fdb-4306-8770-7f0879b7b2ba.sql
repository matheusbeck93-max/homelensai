-- ai_credit_ledger: explicit deny for UPDATE/DELETE from clients (defense in depth)
CREATE POLICY "Block client updates to credit ledger"
  ON public.ai_credit_ledger FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "Block client deletes from credit ledger"
  ON public.ai_credit_ledger FOR DELETE TO authenticated, anon
  USING (false);

-- legacy_upgrade_nudges: remove client write policies; only service_role writes
DROP POLICY IF EXISTS "Users insert own legacy nudges" ON public.legacy_upgrade_nudges;
DROP POLICY IF EXISTS "Users update own legacy nudges" ON public.legacy_upgrade_nudges;
DROP POLICY IF EXISTS "Users delete own legacy nudges" ON public.legacy_upgrade_nudges;