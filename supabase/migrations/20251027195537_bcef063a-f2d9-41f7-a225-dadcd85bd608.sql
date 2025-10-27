-- Enable pgvector extension for AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Properties table
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  price NUMERIC NOT NULL,
  beds INTEGER NOT NULL,
  baths NUMERIC NOT NULL,
  sqft INTEGER NOT NULL,
  year_built INTEGER,
  lot_size INTEGER,
  taxes NUMERIC,
  condition TEXT CHECK (condition IN ('excellent', 'good', 'fair', 'needs work', 'fixer')),
  list_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'sold')),
  description TEXT,
  image_urls TEXT[],
  arv NUMERIC, -- After Repair Value
  rehab_cost NUMERIC,
  roi_percent NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Property vectors for AI search
CREATE TABLE public.property_vectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  embedding vector(1536), -- OpenAI embedding dimension
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Market metrics
CREATE TABLE public.market_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_id TEXT NOT NULL,
  month DATE NOT NULL,
  price_sqft NUMERIC,
  days_on_market INTEGER,
  list_to_sale_ratio NUMERIC,
  inventory INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(geo_id, month)
);

-- First-time buyer programs
CREATE TABLE public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction TEXT NOT NULL,
  name TEXT NOT NULL,
  eligibility TEXT,
  max_benefit NUMERIC,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Mortgage rates
CREATE TABLE public.rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product TEXT NOT NULL,
  apr NUMERIC NOT NULL,
  points NUMERIC,
  lender TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Saved searches
CREATE TABLE public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  query_text TEXT NOT NULL,
  filters_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Property analyses
CREATE TABLE public.analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  analysis_json JSONB,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

-- Public read access for properties, market data, programs, and rates
CREATE POLICY "Properties are viewable by everyone"
  ON public.properties FOR SELECT
  USING (true);

CREATE POLICY "Property vectors are viewable by everyone"
  ON public.property_vectors FOR SELECT
  USING (true);

CREATE POLICY "Market metrics are viewable by everyone"
  ON public.market_metrics FOR SELECT
  USING (true);

CREATE POLICY "Programs are viewable by everyone"
  ON public.programs FOR SELECT
  USING (true);

CREATE POLICY "Rates are viewable by everyone"
  ON public.rates FOR SELECT
  USING (true);

-- Profile policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Saved searches policies
CREATE POLICY "Users can view their own saved searches"
  ON public.saved_searches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own saved searches"
  ON public.saved_searches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved searches"
  ON public.saved_searches FOR DELETE
  USING (auth.uid() = user_id);

-- Analyses policies
CREATE POLICY "Users can view their own analyses"
  ON public.analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own analyses"
  ON public.analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert sample properties
INSERT INTO public.properties (address, city, state, zip, price, beds, baths, sqft, year_built, lot_size, taxes, condition, description, image_urls, arv, rehab_cost, roi_percent) VALUES
('123 Main St', 'Arlington', 'VA', '22201', 550000, 3, 2, 1800, 1985, 5000, 6500, 'needs work', 'Great opportunity for investors. Solid bones, needs cosmetic updates.', ARRAY['https://images.unsplash.com/photo-1568605114967-8130f3a36994'], 750000, 80000, 18),
('456 Oak Ave', 'Alexandria', 'VA', '22301', 625000, 4, 2.5, 2200, 1990, 6000, 7200, 'good', 'Move-in ready home in desirable neighborhood. Updated kitchen.', ARRAY['https://images.unsplash.com/photo-1572120360610-d971b9d7767c'], 680000, 30000, 8),
('789 Pine Rd', 'Falls Church', 'VA', '22041', 480000, 3, 2, 1600, 1978, 4500, 5800, 'fixer', 'Handyman special. Priced to sell quickly. Great bones.', ARRAY['https://images.unsplash.com/photo-1564013799919-ab600027ffc6'], 700000, 120000, 22),
('321 Elm St', 'Arlington', 'VA', '22202', 695000, 4, 3, 2400, 2000, 7000, 8200, 'excellent', 'Beautifully maintained home. Hardwood floors throughout.', ARRAY['https://images.unsplash.com/photo-1580587771525-78b9dba3b914'], 720000, 15000, 5),
('654 Maple Dr', 'Alexandria', 'VA', '22302', 520000, 3, 2, 1700, 1982, 5500, 6200, 'fair', 'Needs some TLC but in great location. Newer roof.', ARRAY['https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6'], 680000, 90000, 15);

-- Insert sample programs
INSERT INTO public.programs (jurisdiction, name, eligibility, max_benefit, link) VALUES
('Virginia', 'Virginia Housing Down Payment Assistance', 'First-time buyers, income limits apply', 15000, 'https://www.virginiahousing.com'),
('Arlington County', 'Arlington Home Purchase Assistance', 'Must work in Arlington, income under 80% AMI', 20000, 'https://www.arlingtonva.us'),
('Alexandria', 'Alexandria AHAP', 'First-time buyers, income limits', 12500, 'https://www.alexandriava.gov');

-- Insert sample rates
INSERT INTO public.rates (product, apr, points, lender) VALUES
('30-Year Fixed', 6.875, 0, 'National Bank'),
('15-Year Fixed', 6.125, 0, 'National Bank'),
('5/1 ARM', 6.250, 0, 'National Bank'),
('FHA 30-Year', 6.500, 0, 'Federal Lender');