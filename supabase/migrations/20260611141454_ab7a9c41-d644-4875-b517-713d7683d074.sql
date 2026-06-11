
-- saved_properties extensions
ALTER TABLE public.saved_properties
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'main_app'
    CHECK (source IN ('main_app','chrome_extension','investor_console')),
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb,
  ADD COLUMN IF NOT EXISTS price numeric,
  ADD COLUMN IF NOT EXISTS beds integer,
  ADD COLUMN IF NOT EXISTS baths numeric,
  ADD COLUMN IF NOT EXISTS sqft integer,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_saved_properties_updated_at ON public.saved_properties;
CREATE TRIGGER update_saved_properties_updated_at
  BEFORE UPDATE ON public.saved_properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- conversations extensions
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'main_app'
    CHECK (source IN ('main_app','chrome_extension')),
  ADD COLUMN IF NOT EXISTS client_thread_id text,
  ADD COLUMN IF NOT EXISTS property_url text;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_user_client_thread_idx
  ON public.conversations(user_id, client_thread_id)
  WHERE client_thread_id IS NOT NULL;

-- Realtime (idempotent — ignore if already added)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_properties;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
