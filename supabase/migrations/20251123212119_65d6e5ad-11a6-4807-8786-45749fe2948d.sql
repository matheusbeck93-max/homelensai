-- Add weekly picks preferences to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS weekly_picks_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS weekly_picks_day TEXT DEFAULT 'monday',
ADD COLUMN IF NOT EXISTS weekly_picks_last_sent TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS preferred_cities TEXT[],
ADD COLUMN IF NOT EXISTS max_price_range NUMERIC,
ADD COLUMN IF NOT EXISTS min_bedrooms INTEGER DEFAULT 2;

-- Create table to track sent weekly picks
CREATE TABLE IF NOT EXISTS public.weekly_picks_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  property_ids UUID[] NOT NULL,
  email_sent BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_weekly_picks_user_id ON public.weekly_picks_history(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_picks_sent_at ON public.weekly_picks_history(sent_at DESC);

-- Enable RLS
ALTER TABLE public.weekly_picks_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for weekly_picks_history
CREATE POLICY "Users can view their own weekly picks history" 
ON public.weekly_picks_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own weekly picks history" 
ON public.weekly_picks_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);