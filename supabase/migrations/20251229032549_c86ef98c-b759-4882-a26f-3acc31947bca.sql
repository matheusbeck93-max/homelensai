-- Phase 1: Security Hardening - Add missing RLS policies

-- 1. Alert events - restrict INSERT to service role only (edge functions)
-- The table already has SELECT and UPDATE for users, but INSERT should be service-only
CREATE POLICY "Service role can insert alert events"
ON public.alert_events
FOR INSERT
TO service_role
WITH CHECK (true);

-- 2. Sent alerts - add UPDATE and DELETE policies for user_id
CREATE POLICY "Users can update their own sent alerts"
ON public.sent_alerts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sent alerts"
ON public.sent_alerts
FOR DELETE
USING (auth.uid() = user_id);

-- 3. Weekly picks history - add UPDATE and DELETE policies
CREATE POLICY "Users can update their own weekly picks history"
ON public.weekly_picks_history
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own weekly picks history"
ON public.weekly_picks_history
FOR DELETE
USING (auth.uid() = user_id);

-- 4. Alert preferences - add DELETE policy
CREATE POLICY "Users can delete their own alert preferences"
ON public.alert_preferences
FOR DELETE
USING (auth.uid() = user_id);