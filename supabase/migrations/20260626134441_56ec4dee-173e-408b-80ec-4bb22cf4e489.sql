
CREATE POLICY "Staff can upload blog covers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'blog-covers'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_staff = true)
  );

CREATE POLICY "Staff can update blog covers"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'blog-covers'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_staff = true)
  );

CREATE POLICY "Staff can delete blog covers"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'blog-covers'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_staff = true)
  );

CREATE POLICY "Authenticated can read blog covers"
  ON storage.objects FOR SELECT
  TO authenticated, anon
  USING (bucket_id = 'blog-covers');
