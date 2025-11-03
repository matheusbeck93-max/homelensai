-- Extend profiles table with user preferences
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS budget_min numeric,
ADD COLUMN IF NOT EXISTS budget_max numeric,
ADD COLUMN IF NOT EXISTS desired_monthly_payment numeric,
ADD COLUMN IF NOT EXISTS location_preferences jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS property_types text[] DEFAULT ARRAY[]::text[],
ADD COLUMN IF NOT EXISTS risk_level text CHECK (risk_level IN ('conservative', 'moderate', 'aggressive')),
ADD COLUMN IF NOT EXISTS buyer_type text CHECK (buyer_type IN ('investor', 'first-time-buyer', 'regular-buyer')) DEFAULT 'regular-buyer',
ADD COLUMN IF NOT EXISTS commute_preferences jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.location_preferences IS 'JSON array of preferred cities, neighborhoods, or areas';
COMMENT ON COLUMN public.profiles.property_types IS 'Array of property types: condo, townhome, single-family, multi-family';
COMMENT ON COLUMN public.profiles.commute_preferences IS 'JSON object with commute time and walkability preferences';

-- Update the updated_at trigger to work with profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();