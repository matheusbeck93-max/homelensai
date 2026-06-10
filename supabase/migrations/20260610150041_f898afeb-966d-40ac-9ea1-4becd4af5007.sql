
-- 1. Add denormalized user_id to investor_owned_property_alerts
ALTER TABLE public.investor_owned_property_alerts ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE public.investor_owned_property_alerts a
  SET user_id = p.user_id
  FROM public.investor_owned_properties p
  WHERE a.property_id = p.id AND a.user_id IS NULL;
ALTER TABLE public.investor_owned_property_alerts ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_iop_alerts_user_id ON public.investor_owned_property_alerts(user_id);

CREATE OR REPLACE FUNCTION public.set_iop_alert_user_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id FROM public.investor_owned_properties WHERE id = NEW.property_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_iop_alert_user_id ON public.investor_owned_property_alerts;
CREATE TRIGGER trg_set_iop_alert_user_id BEFORE INSERT ON public.investor_owned_property_alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_iop_alert_user_id();

DROP POLICY IF EXISTS "Users access alerts for their own properties" ON public.investor_owned_property_alerts;
CREATE POLICY "Users access own alerts" ON public.investor_owned_property_alerts
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.investor_owned_properties p WHERE p.id = property_id AND p.user_id = auth.uid()))
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.investor_owned_properties p WHERE p.id = property_id AND p.user_id = auth.uid()));

-- 2. Same for investor_owned_property_documents
ALTER TABLE public.investor_owned_property_documents ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE public.investor_owned_property_documents d
  SET user_id = p.user_id
  FROM public.investor_owned_properties p
  WHERE d.property_id = p.id AND d.user_id IS NULL;
ALTER TABLE public.investor_owned_property_documents ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_iop_docs_user_id ON public.investor_owned_property_documents(user_id);

CREATE OR REPLACE FUNCTION public.set_iop_doc_user_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id FROM public.investor_owned_properties WHERE id = NEW.property_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_set_iop_doc_user_id ON public.investor_owned_property_documents;
CREATE TRIGGER trg_set_iop_doc_user_id BEFORE INSERT ON public.investor_owned_property_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_iop_doc_user_id();

DROP POLICY IF EXISTS "Users access documents for their own properties" ON public.investor_owned_property_documents;
CREATE POLICY "Users access own documents" ON public.investor_owned_property_documents
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.investor_owned_properties p WHERE p.id = property_id AND p.user_id = auth.uid()))
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.investor_owned_properties p WHERE p.id = property_id AND p.user_id = auth.uid()));

-- 3. subscription_plans: public read policy (RLS enabled, no policy)
GRANT SELECT ON public.subscription_plans TO anon, authenticated;
CREATE POLICY "Public can view subscription plans" ON public.subscription_plans
  FOR SELECT TO anon, authenticated USING (true);
