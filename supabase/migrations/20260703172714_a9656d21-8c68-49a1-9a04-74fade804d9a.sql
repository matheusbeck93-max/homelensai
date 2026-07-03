
-- Generic trigger function that copies user_id from parent investor_owned_properties
CREATE OR REPLACE FUNCTION public.set_iop_child_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id
    FROM public.investor_owned_properties
    WHERE id = NEW.property_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ============ events ============
ALTER TABLE public.investor_owned_property_events ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE public.investor_owned_property_events e
SET user_id = p.user_id
FROM public.investor_owned_properties p
WHERE e.property_id = p.id AND e.user_id IS NULL;
ALTER TABLE public.investor_owned_property_events ALTER COLUMN user_id SET NOT NULL;

DROP TRIGGER IF EXISTS set_iop_event_user_id ON public.investor_owned_property_events;
CREATE TRIGGER set_iop_event_user_id
BEFORE INSERT ON public.investor_owned_property_events
FOR EACH ROW EXECUTE FUNCTION public.set_iop_child_user_id();

DROP POLICY IF EXISTS "Users access events for their own properties" ON public.investor_owned_property_events;
CREATE POLICY "Users access events for their own properties"
ON public.investor_owned_property_events
FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.investor_owned_properties p
              WHERE p.id = investor_owned_property_events.property_id AND p.user_id = auth.uid())
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.investor_owned_properties p
              WHERE p.id = investor_owned_property_events.property_id AND p.user_id = auth.uid())
);

-- ============ improvements ============
ALTER TABLE public.investor_owned_property_improvements ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE public.investor_owned_property_improvements c
SET user_id = p.user_id
FROM public.investor_owned_properties p
WHERE c.property_id = p.id AND c.user_id IS NULL;
ALTER TABLE public.investor_owned_property_improvements ALTER COLUMN user_id SET NOT NULL;

DROP TRIGGER IF EXISTS set_iop_improvement_user_id ON public.investor_owned_property_improvements;
CREATE TRIGGER set_iop_improvement_user_id
BEFORE INSERT ON public.investor_owned_property_improvements
FOR EACH ROW EXECUTE FUNCTION public.set_iop_child_user_id();

DROP POLICY IF EXISTS "Users access improvements for their own properties" ON public.investor_owned_property_improvements;
CREATE POLICY "Users access improvements for their own properties"
ON public.investor_owned_property_improvements
FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.investor_owned_properties p
              WHERE p.id = investor_owned_property_improvements.property_id AND p.user_id = auth.uid())
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.investor_owned_properties p
              WHERE p.id = investor_owned_property_improvements.property_id AND p.user_id = auth.uid())
);

-- ============ rental ============
ALTER TABLE public.investor_owned_property_rental ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE public.investor_owned_property_rental c
SET user_id = p.user_id
FROM public.investor_owned_properties p
WHERE c.property_id = p.id AND c.user_id IS NULL;
ALTER TABLE public.investor_owned_property_rental ALTER COLUMN user_id SET NOT NULL;

DROP TRIGGER IF EXISTS set_iop_rental_user_id ON public.investor_owned_property_rental;
CREATE TRIGGER set_iop_rental_user_id
BEFORE INSERT ON public.investor_owned_property_rental
FOR EACH ROW EXECUTE FUNCTION public.set_iop_child_user_id();

DROP POLICY IF EXISTS "Users access rental for their own properties" ON public.investor_owned_property_rental;
CREATE POLICY "Users access rental for their own properties"
ON public.investor_owned_property_rental
FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.investor_owned_properties p
              WHERE p.id = investor_owned_property_rental.property_id AND p.user_id = auth.uid())
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.investor_owned_properties p
              WHERE p.id = investor_owned_property_rental.property_id AND p.user_id = auth.uid())
);

-- ============ valuations ============
ALTER TABLE public.investor_owned_property_valuations ADD COLUMN IF NOT EXISTS user_id uuid;
UPDATE public.investor_owned_property_valuations c
SET user_id = p.user_id
FROM public.investor_owned_properties p
WHERE c.property_id = p.id AND c.user_id IS NULL;
ALTER TABLE public.investor_owned_property_valuations ALTER COLUMN user_id SET NOT NULL;

DROP TRIGGER IF EXISTS set_iop_valuation_user_id ON public.investor_owned_property_valuations;
CREATE TRIGGER set_iop_valuation_user_id
BEFORE INSERT ON public.investor_owned_property_valuations
FOR EACH ROW EXECUTE FUNCTION public.set_iop_child_user_id();

DROP POLICY IF EXISTS "Users access valuations for their own properties" ON public.investor_owned_property_valuations;
CREATE POLICY "Users access valuations for their own properties"
ON public.investor_owned_property_valuations
FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.investor_owned_properties p
              WHERE p.id = investor_owned_property_valuations.property_id AND p.user_id = auth.uid())
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.investor_owned_properties p
              WHERE p.id = investor_owned_property_valuations.property_id AND p.user_id = auth.uid())
);
