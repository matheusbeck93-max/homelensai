
-- Make owned-property-photos bucket private (use signed URLs for display)
UPDATE storage.buckets SET public = false WHERE id = 'owned-property-photos';

-- Replace the public-read policy with owner-only read scoped to user_id folder
DROP POLICY IF EXISTS "Owned property photos are publicly readable" ON storage.objects;

CREATE POLICY "Users read their own owned property photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'owned-property-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
