ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_credits_used_today integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_credits_last_reset date NOT NULL DEFAULT CURRENT_DATE;