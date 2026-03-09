ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS investment_strategy text,
  ADD COLUMN IF NOT EXISTS hold_period_years integer,
  ADD COLUMN IF NOT EXISTS financing_preference text,
  ADD COLUMN IF NOT EXISTS min_bathrooms integer,
  ADD COLUMN IF NOT EXISTS must_have_features text[],
  ADD COLUMN IF NOT EXISTS has_children boolean,
  ADD COLUMN IF NOT EXISTS children_ages text[],
  ADD COLUMN IF NOT EXISTS climate_preference text,
  ADD COLUMN IF NOT EXISTS safety_priority text;