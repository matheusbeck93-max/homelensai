-- Add is_dev_call tagging to ai_usage_log and ai_credit_ledger for Dev/Prod spend isolation (PR #1)
ALTER TABLE public.ai_usage_log ADD COLUMN IF NOT EXISTS is_dev_call boolean NOT NULL DEFAULT false;
ALTER TABLE public.ai_credit_ledger ADD COLUMN IF NOT EXISTS is_dev_call boolean NOT NULL DEFAULT false;

-- Add feature quota tracking columns to profiles for unified usage gates (PR #2)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_chat_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_photos_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_briefs_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS monthly_quota_reset_date date;

-- Index for fast daily/monthly budget guard checks filtering out dev calls
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_prod_spend ON public.ai_usage_log(user_id, usage_date) WHERE is_dev_call = false;