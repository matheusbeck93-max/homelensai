ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS about_me text,
  ADD COLUMN IF NOT EXISTS buyer_types text[],
  ADD COLUMN IF NOT EXISTS investment_strategies text[],
  ADD COLUMN IF NOT EXISTS financing_preferences text[];