-- Add alert functionality to saved_searches table
ALTER TABLE public.saved_searches
ADD COLUMN IF NOT EXISTS alert_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS alert_frequency text CHECK (alert_frequency IN ('daily', 'weekly', 'instant')) DEFAULT 'daily',
ADD COLUMN IF NOT EXISTS last_alert_sent timestamp with time zone;

-- Create index for alert queries
CREATE INDEX IF NOT EXISTS idx_saved_searches_alerts 
ON public.saved_searches(user_id, alert_enabled) 
WHERE alert_enabled = true;