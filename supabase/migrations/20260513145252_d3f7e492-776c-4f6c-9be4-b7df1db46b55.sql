-- Restrict property_vectors public read; require authentication
DROP POLICY IF EXISTS "Property vectors are viewable by everyone" ON public.property_vectors;
CREATE POLICY "Authenticated users can view property vectors"
ON public.property_vectors
FOR SELECT
TO authenticated
USING (true);

-- Harden handle_new_user with input validation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_full_name text;
BEGIN
  v_full_name := NULLIF(trim(new.raw_user_meta_data->>'full_name'), '');

  IF v_full_name IS NOT NULL AND length(v_full_name) > 200 THEN
    v_full_name := substring(v_full_name from 1 for 200);
  END IF;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, v_full_name);

  RETURN new;
END;
$function$;

-- Revoke direct API EXECUTE on internal trigger helpers (they still fire as triggers)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
