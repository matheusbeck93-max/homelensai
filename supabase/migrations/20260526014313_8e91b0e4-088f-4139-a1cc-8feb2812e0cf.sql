ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cash_available numeric,
  ADD COLUMN IF NOT EXISTS financing_defaults jsonb NOT NULL DEFAULT '{"downPct":25,"rateApr":7,"termYears":30}'::jsonb;