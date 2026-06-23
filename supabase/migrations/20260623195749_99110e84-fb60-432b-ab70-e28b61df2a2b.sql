
-- 1. legacy_upgrade_nudges: explicit deny for anon (defense in depth)
CREATE POLICY "Deny anon access to legacy_upgrade_nudges"
ON public.legacy_upgrade_nudges
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 2. open_house_cache: restrict SELECT to service_role only
DROP POLICY IF EXISTS "Authenticated users can read open house cache" ON public.open_house_cache;
DROP POLICY IF EXISTS "Authenticated can read open_house_cache" ON public.open_house_cache;
DROP POLICY IF EXISTS "open_house_cache_select" ON public.open_house_cache;
DROP POLICY IF EXISTS "Allow authenticated read" ON public.open_house_cache;

REVOKE SELECT ON public.open_house_cache FROM authenticated, anon;

-- 3. profiles: re-scope policies from public to authenticated
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own profile"
ON public.profiles FOR DELETE TO authenticated
USING (auth.uid() = id);

-- 4. search_cache: remove public read access
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'search_cache'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.search_cache', pol.policyname);
  END LOOP;
END $$;

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.search_cache FROM anon, authenticated;
GRANT ALL ON public.search_cache TO service_role;

CREATE POLICY "Deny anon access to search_cache"
ON public.search_cache AS RESTRICTIVE FOR ALL TO anon
USING (false) WITH CHECK (false);

CREATE POLICY "Deny authenticated access to search_cache"
ON public.search_cache AS RESTRICTIVE FOR ALL TO authenticated
USING (false) WITH CHECK (false);
