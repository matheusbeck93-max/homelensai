-- Remove profiles from realtime publication (sensitive Stripe IDs etc.)
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;

-- Lock down open_house_cache to service_role only
DROP POLICY IF EXISTS "Authenticated users can read cache" ON public.open_house_cache;

CREATE POLICY "Deny all access to authenticated"
ON public.open_house_cache
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny all access to anon"
ON public.open_house_cache
AS RESTRICTIVE
FOR ALL
TO anon
USING (false)
WITH CHECK (false);