
CREATE TABLE public.saved_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  property_url text NOT NULL,
  property_address text NOT NULL,
  city text,
  state text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX saved_properties_user_url_unique
  ON public.saved_properties (user_id, property_url);

CREATE INDEX saved_properties_user_created_idx
  ON public.saved_properties (user_id, created_at DESC);

ALTER TABLE public.saved_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved properties"
  ON public.saved_properties FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved properties"
  ON public.saved_properties FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved properties"
  ON public.saved_properties FOR DELETE
  USING (auth.uid() = user_id);
