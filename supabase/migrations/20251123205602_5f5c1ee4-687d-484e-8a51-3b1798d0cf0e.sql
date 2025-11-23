-- Add subscription fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'pro', 'premium')),
ADD COLUMN IF NOT EXISTS subscription_renews_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_cancel_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS daily_analysis_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_analysis_last_reset DATE DEFAULT CURRENT_DATE;

-- Add index for faster subscription queries
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON public.profiles(subscription_status);

-- Add comment to document the schema
COMMENT ON COLUMN public.profiles.subscription_status IS 'User subscription tier: free, pro, or premium';
COMMENT ON COLUMN public.profiles.daily_analysis_count IS 'Number of AI analyses used today (resets daily for free tier)';
COMMENT ON COLUMN public.profiles.daily_analysis_last_reset IS 'Last date when daily_analysis_count was reset';