
-- Remove profiles from realtime publication (broadcasts sensitive user data)
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;

-- Explicit restrictive write policies on tool_call_telemetry
-- Only service role (which bypasses RLS) should write; deny all authenticated/anon writes.
CREATE POLICY "Deny client inserts" ON public.tool_call_telemetry
  FOR INSERT TO authenticated, anon WITH CHECK (false);
CREATE POLICY "Deny client updates" ON public.tool_call_telemetry
  FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false);
CREATE POLICY "Deny client deletes" ON public.tool_call_telemetry
  FOR DELETE TO authenticated, anon USING (false);
