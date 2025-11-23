-- Create portfolio_properties table for Premium users
CREATE TABLE public.portfolio_properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  purchase_price NUMERIC NOT NULL,
  down_payment_pct NUMERIC NOT NULL DEFAULT 20,
  interest_rate_pct NUMERIC NOT NULL DEFAULT 7,
  loan_term_years INTEGER NOT NULL DEFAULT 30,
  monthly_rent NUMERIC NOT NULL DEFAULT 0,
  monthly_expenses NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.portfolio_properties ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own portfolio properties"
ON public.portfolio_properties
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can add properties to their portfolio"
ON public.portfolio_properties
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their portfolio properties"
ON public.portfolio_properties
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can remove properties from their portfolio"
ON public.portfolio_properties
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_portfolio_properties_updated_at
BEFORE UPDATE ON public.portfolio_properties
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();