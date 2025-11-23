-- Create table to track property snapshots for change detection
CREATE TABLE IF NOT EXISTS public.property_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  status TEXT NOT NULL,
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_property_snapshots_property_id ON public.property_snapshots(property_id);
CREATE INDEX IF NOT EXISTS idx_property_snapshots_captured_at ON public.property_snapshots(captured_at DESC);

-- Add alert preferences to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS alert_price_drops BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS alert_status_changes BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS alert_email_enabled BOOLEAN DEFAULT true;

-- Create table to track sent alerts (prevent duplicate notifications)
CREATE TABLE IF NOT EXISTS public.sent_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_sent_alerts_user_property ON public.sent_alerts(user_id, property_id);
CREATE INDEX IF NOT EXISTS idx_sent_alerts_sent_at ON public.sent_alerts(sent_at DESC);

-- Enable RLS on new tables
ALTER TABLE public.property_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for property_snapshots (read-only for authenticated users)
CREATE POLICY "Property snapshots are viewable by everyone" 
ON public.property_snapshots 
FOR SELECT 
USING (true);

-- RLS policies for sent_alerts (users can only view their own alerts)
CREATE POLICY "Users can view their own sent alerts" 
ON public.sent_alerts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sent alerts" 
ON public.sent_alerts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);