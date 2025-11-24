-- Smart Alerts: alert_preferences table
CREATE TABLE IF NOT EXISTS public.alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly')),
  channels JSONB NOT NULL DEFAULT '["email", "in_app"]'::jsonb,
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Smart Alerts: alert_events table
CREATE TABLE IF NOT EXISTS public.alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('price_drop', 'status_change', 'new_match')),
  property_id TEXT NOT NULL,
  property_snapshot JSONB NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read BOOLEAN NOT NULL DEFAULT false
);

-- Compare: compare_sets table (stores user's active compare list)
CREATE TABLE IF NOT EXISTS public.compare_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compare_sets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for alert_preferences
CREATE POLICY "Users can view their own alert preferences"
  ON public.alert_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alert preferences"
  ON public.alert_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alert preferences"
  ON public.alert_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for alert_events
CREATE POLICY "Users can view their own alert events"
  ON public.alert_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own alert events"
  ON public.alert_events FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for compare_sets
CREATE POLICY "Users can view their own compare sets"
  ON public.compare_sets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own compare sets"
  ON public.compare_sets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own compare sets"
  ON public.compare_sets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own compare sets"
  ON public.compare_sets FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at on alert_preferences
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_alert_preferences_updated_at
  BEFORE UPDATE ON public.alert_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_compare_sets_updated_at
  BEFORE UPDATE ON public.compare_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_alert_events_user_read ON public.alert_events(user_id, read);
CREATE INDEX idx_alert_events_created_at ON public.alert_events(created_at DESC);
CREATE INDEX idx_alert_preferences_user ON public.alert_preferences(user_id);
CREATE INDEX idx_compare_sets_user ON public.compare_sets(user_id);