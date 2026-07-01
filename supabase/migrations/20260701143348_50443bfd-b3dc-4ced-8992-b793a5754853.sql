DROP POLICY IF EXISTS "Users create own artifacts" ON public.artifacts;

CREATE POLICY "Anyone can read blog covers"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'blog-covers');

DROP POLICY IF EXISTS "Authenticated can read blog covers" ON storage.objects;