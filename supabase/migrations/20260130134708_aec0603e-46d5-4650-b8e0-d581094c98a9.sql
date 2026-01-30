-- Fix overly permissive RLS policies on search_cache and market_snapshots
-- These tables should only be writable by service_role (used by edge functions)

-- Drop existing permissive INSERT/UPDATE policies on search_cache
DROP POLICY IF EXISTS "System can insert search cache" ON public.search_cache;
DROP POLICY IF EXISTS "System can update search cache" ON public.search_cache;

-- Create new policies that only allow service_role to write
-- Note: Service role bypasses RLS, but we create explicit deny policies for anon/authenticated
CREATE POLICY "Block public insert on search cache"
ON public.search_cache
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "Block public update on search cache"
ON public.search_cache
FOR UPDATE
TO anon, authenticated
USING (false);

-- Drop existing permissive INSERT/UPDATE policies on market_snapshots
DROP POLICY IF EXISTS "System can insert market snapshots" ON public.market_snapshots;
DROP POLICY IF EXISTS "System can update market snapshots" ON public.market_snapshots;

-- Create new policies that only allow service_role to write
CREATE POLICY "Block public insert on market snapshots"
ON public.market_snapshots
FOR INSERT
TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "Block public update on market snapshots"
ON public.market_snapshots
FOR UPDATE
TO anon, authenticated
USING (false);