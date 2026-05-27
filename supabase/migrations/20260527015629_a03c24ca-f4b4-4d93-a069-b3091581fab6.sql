
-- ============================================================
-- INVESTOR MY PROPERTIES (Portfolio Mode) — Phase 1 schema
-- ============================================================

-- 1) Owned properties (parent)
CREATE TABLE public.investor_owned_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,

  -- Identity
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  state text NOT NULL,
  zip text NOT NULL,
  property_type text NOT NULL CHECK (property_type IN
    ('single_family','townhome','condo','duplex','triplex','fourplex','multifamily','land','other')),
  beds int,
  baths numeric(3,1),
  sqft int,
  lot_sqft int,
  year_built int,

  -- Acquisition
  purchase_date date NOT NULL,
  purchase_price numeric(12,2) NOT NULL,
  down_payment numeric(12,2),
  closing_costs numeric(12,2),

  -- Loan
  has_mortgage boolean NOT NULL DEFAULT true,
  loan_original_principal numeric(12,2),
  loan_rate_apr numeric(6,5),
  loan_term_years int,
  loan_start_date date,
  loan_current_balance numeric(12,2),
  loan_current_balance_as_of date,

  -- Current state
  is_primary_residence boolean NOT NULL DEFAULT false,
  is_rented boolean NOT NULL DEFAULT false,
  current_value_estimate numeric(12,2),
  current_value_source text CHECK (current_value_source IN
    ('zestimate','realtor','rentcast','manual_appraisal','manual_override','seed')),
  current_value_confidence_low numeric(12,2),
  current_value_confidence_high numeric(12,2),
  current_value_refreshed_at timestamptz,
  current_value_manual_override numeric(12,2),
  current_value_manual_note text,
  current_value_manual_expires_at timestamptz,

  -- Photos
  primary_photo_url text,

  -- Auto-refresh preference (per property)
  auto_refresh_enabled boolean NOT NULL DEFAULT true,

  -- Status
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','archived')),
  sold_date date,
  sold_price numeric(12,2),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX iop_user_idx ON public.investor_owned_properties(user_id, status, updated_at DESC);
CREATE INDEX iop_city_state_idx ON public.investor_owned_properties(city, state) WHERE status = 'active';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_owned_properties TO authenticated;
GRANT ALL ON public.investor_owned_properties TO service_role;
ALTER TABLE public.investor_owned_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own owned properties"
  ON public.investor_owned_properties FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert their own owned properties"
  ON public.investor_owned_properties FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own owned properties"
  ON public.investor_owned_properties FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete their own owned properties"
  ON public.investor_owned_properties FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER iop_set_updated_at
  BEFORE UPDATE ON public.investor_owned_properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2) Photos
CREATE TABLE public.investor_owned_property_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.investor_owned_properties(id) ON DELETE CASCADE,
  url text NOT NULL,
  caption text,
  ordinal int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX iopp_property_idx ON public.investor_owned_property_photos(property_id, ordinal);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_owned_property_photos TO authenticated;
GRANT ALL ON public.investor_owned_property_photos TO service_role;
ALTER TABLE public.investor_owned_property_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access photos for their own properties"
  ON public.investor_owned_property_photos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.investor_owned_properties p
                 WHERE p.id = property_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.investor_owned_properties p
                      WHERE p.id = property_id AND p.user_id = auth.uid()));


-- 3) Rental details
CREATE TABLE public.investor_owned_property_rental (
  property_id uuid PRIMARY KEY REFERENCES public.investor_owned_properties(id) ON DELETE CASCADE,
  monthly_rent numeric(10,2),
  lease_start date,
  lease_end date,
  security_deposit numeric(10,2),
  property_tax_yearly numeric(10,2),
  insurance_yearly numeric(10,2),
  insurance_renewal_date date,
  hoa_monthly numeric(10,2),
  maintenance_pct_of_rent numeric(5,4) DEFAULT 0.08,
  management_pct_of_rent numeric(5,4) DEFAULT 0.08,
  vacancy_pct numeric(5,4) DEFAULT 0.05,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_owned_property_rental TO authenticated;
GRANT ALL ON public.investor_owned_property_rental TO service_role;
ALTER TABLE public.investor_owned_property_rental ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access rental for their own properties"
  ON public.investor_owned_property_rental FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.investor_owned_properties p
                 WHERE p.id = property_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.investor_owned_properties p
                      WHERE p.id = property_id AND p.user_id = auth.uid()));

CREATE TRIGGER iopr_set_updated_at
  BEFORE UPDATE ON public.investor_owned_property_rental
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 4) Valuations history
CREATE TABLE public.investor_owned_property_valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.investor_owned_properties(id) ON DELETE CASCADE,
  observed_at timestamptz NOT NULL DEFAULT now(),
  value numeric(12,2) NOT NULL,
  confidence_low numeric(12,2),
  confidence_high numeric(12,2),
  source text NOT NULL,
  source_payload jsonb,
  note text
);
CREATE INDEX iopv_property_observed_idx
  ON public.investor_owned_property_valuations(property_id, observed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_owned_property_valuations TO authenticated;
GRANT ALL ON public.investor_owned_property_valuations TO service_role;
ALTER TABLE public.investor_owned_property_valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access valuations for their own properties"
  ON public.investor_owned_property_valuations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.investor_owned_properties p
                 WHERE p.id = property_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.investor_owned_properties p
                      WHERE p.id = property_id AND p.user_id = auth.uid()));


-- 5) Improvements / renovations
CREATE TABLE public.investor_owned_property_improvements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.investor_owned_properties(id) ON DELETE CASCADE,
  improvement_date date NOT NULL,
  description text NOT NULL,
  cost numeric(10,2) NOT NULL,
  category text CHECK (category IN
    ('roof','hvac','kitchen','bath','windows','siding','flooring','addition','landscape','other')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX iopi_property_idx
  ON public.investor_owned_property_improvements(property_id, improvement_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_owned_property_improvements TO authenticated;
GRANT ALL ON public.investor_owned_property_improvements TO service_role;
ALTER TABLE public.investor_owned_property_improvements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access improvements for their own properties"
  ON public.investor_owned_property_improvements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.investor_owned_properties p
                 WHERE p.id = property_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.investor_owned_properties p
                      WHERE p.id = property_id AND p.user_id = auth.uid()));


-- 6) Events timeline
CREATE TABLE public.investor_owned_property_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.investor_owned_properties(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN
    ('purchased','refinanced','rented','vacated','appraised','improved','sold','note','alert_acted')),
  event_date date NOT NULL,
  details jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX iope_property_idx
  ON public.investor_owned_property_events(property_id, event_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_owned_property_events TO authenticated;
GRANT ALL ON public.investor_owned_property_events TO service_role;
ALTER TABLE public.investor_owned_property_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access events for their own properties"
  ON public.investor_owned_property_events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.investor_owned_properties p
                 WHERE p.id = property_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.investor_owned_properties p
                      WHERE p.id = property_id AND p.user_id = auth.uid()));


-- 7) Strategic alerts
CREATE TABLE public.investor_owned_property_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.investor_owned_properties(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN
    ('refi_opportunity','heloc_eligible','rent_below_market','insurance_renewal','sell_vs_hold','tax_basis_event','appraisal_due')),
  severity text NOT NULL CHECK (severity IN ('info','opportunity','warning')),
  title text NOT NULL,
  description text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','dismissed','acted','expired')),
  surfaced_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,
  expires_at timestamptz,
  UNIQUE (property_id, alert_type, status) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX iopal_property_status_idx
  ON public.investor_owned_property_alerts(property_id, status, surfaced_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_owned_property_alerts TO authenticated;
GRANT ALL ON public.investor_owned_property_alerts TO service_role;
ALTER TABLE public.investor_owned_property_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access alerts for their own properties"
  ON public.investor_owned_property_alerts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.investor_owned_properties p
                 WHERE p.id = property_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.investor_owned_properties p
                      WHERE p.id = property_id AND p.user_id = auth.uid()));


-- 8) Documents
CREATE TABLE public.investor_owned_property_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.investor_owned_properties(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN
    ('closing','lease','insurance','tax','appraisal','inspection','warranty','other')),
  filename text NOT NULL,
  storage_path text NOT NULL,
  size_bytes int,
  mime_type text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  note text
);
CREATE INDEX iopd_property_type_idx
  ON public.investor_owned_property_documents(property_id, document_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_owned_property_documents TO authenticated;
GRANT ALL ON public.investor_owned_property_documents TO service_role;
ALTER TABLE public.investor_owned_property_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access documents for their own properties"
  ON public.investor_owned_property_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.investor_owned_properties p
                 WHERE p.id = property_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.investor_owned_properties p
                      WHERE p.id = property_id AND p.user_id = auth.uid()));


-- 9) Extend investor_console_threads for per-property chat scope
ALTER TABLE public.investor_console_threads
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.investor_owned_properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'general'
    CHECK (scope IN ('general','property'));

CREATE INDEX IF NOT EXISTS ict_user_property_idx
  ON public.investor_console_threads(user_id, property_id) WHERE property_id IS NOT NULL;


-- 10) Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('owned-property-photos', 'owned-property-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('owned-property-documents', 'owned-property-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Photo bucket policies: public read; owner write under their user_id folder
CREATE POLICY "Owned property photos are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'owned-property-photos');

CREATE POLICY "Users upload owned property photos to their folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'owned-property-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update their own owned property photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'owned-property-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete their own owned property photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'owned-property-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Document bucket policies: private; only owner read/write under their user_id folder
CREATE POLICY "Users read their own owned property documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'owned-property-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users upload owned property documents to their folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'owned-property-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update their own owned property documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'owned-property-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete their own owned property documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'owned-property-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
