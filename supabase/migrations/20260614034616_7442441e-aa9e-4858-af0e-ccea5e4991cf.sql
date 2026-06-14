
CREATE POLICY "Users read own artifact files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'artifacts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own artifact files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'artifacts' AND auth.uid()::text = (storage.foldername(name))[1]);
