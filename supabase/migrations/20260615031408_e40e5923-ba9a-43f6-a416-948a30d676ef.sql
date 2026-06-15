
-- Add missing UPDATE policy on artifacts so owners can update their own rows
CREATE POLICY "Users update own artifacts"
  ON public.artifacts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add SELECT policy on ci_web_events scoped to owner only (prevents future broad reads)
CREATE POLICY "Users read own ci events"
  ON public.ci_web_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- email_suppression: lock down with explicit restrictive deny for non-service roles
CREATE POLICY "Deny anon access to email_suppression"
  ON public.email_suppression
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- email_unsubscribe_tokens: same defense-in-depth restrictive deny
CREATE POLICY "Deny anon access to email_unsubscribe_tokens"
  ON public.email_unsubscribe_tokens
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- email_send_log: add explicit restrictive policy denying writes from clients,
-- making it crystal clear all writes are service_role-only
CREATE POLICY "Deny client writes on email_send_log"
  ON public.email_send_log
  AS RESTRICTIVE
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "Deny client updates on email_send_log"
  ON public.email_send_log
  AS RESTRICTIVE
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny client deletes on email_send_log"
  ON public.email_send_log
  AS RESTRICTIVE
  FOR DELETE
  TO anon, authenticated
  USING (false);
