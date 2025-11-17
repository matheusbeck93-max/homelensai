-- Add DELETE policy for profiles table (GDPR compliance)
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = id);

-- Add restrictive policies for properties table
-- Only allow SELECT for public, block INSERT/UPDATE/DELETE for regular users
CREATE POLICY "Block property insert for regular users"
ON public.properties
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Block property update for regular users"
ON public.properties
FOR UPDATE
USING (false);

CREATE POLICY "Block property delete for regular users"
ON public.properties
FOR DELETE
USING (false);