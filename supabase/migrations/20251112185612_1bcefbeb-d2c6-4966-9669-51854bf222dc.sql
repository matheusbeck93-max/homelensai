-- Create table for saved calculations
CREATE TABLE public.saved_calculations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'My Calculation',
  calculation_type TEXT NOT NULL, -- 'investment' or 'buying_power'
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_calculations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own saved calculations"
ON public.saved_calculations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own saved calculations"
ON public.saved_calculations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved calculations"
ON public.saved_calculations
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved calculations"
ON public.saved_calculations
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_saved_calculations_updated_at
BEFORE UPDATE ON public.saved_calculations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();