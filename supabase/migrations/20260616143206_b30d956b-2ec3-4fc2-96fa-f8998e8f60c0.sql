-- Harden census_cache
DROP POLICY IF EXISTS "Service role only access" ON public.census_cache;
DROP POLICY IF EXISTS "Deny anon access to census_cache" ON public.census_cache;
DROP POLICY IF EXISTS "Deny authenticated access to census_cache" ON public.census_cache;

REVOKE ALL ON public.census_cache FROM anon;
REVOKE ALL ON public.census_cache FROM authenticated;
GRANT ALL ON public.census_cache TO service_role;

ALTER TABLE public.census_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anon access to census_cache"
  ON public.census_cache
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny authenticated access to census_cache"
  ON public.census_cache
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Harden bls_cache
DROP POLICY IF EXISTS "Service role only access" ON public.bls_cache;
DROP POLICY IF EXISTS "Deny anon access to bls_cache" ON public.bls_cache;
DROP POLICY IF EXISTS "Deny authenticated access to bls_cache" ON public.bls_cache;

REVOKE ALL ON public.bls_cache FROM anon;
REVOKE ALL ON public.bls_cache FROM authenticated;
GRANT ALL ON public.bls_cache TO service_role;

ALTER TABLE public.bls_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anon access to bls_cache"
  ON public.bls_cache
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny authenticated access to bls_cache"
  ON public.bls_cache
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);