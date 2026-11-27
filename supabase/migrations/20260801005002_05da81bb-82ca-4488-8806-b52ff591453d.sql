CREATE TABLE public.market_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product text NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  price_kz numeric NOT NULL,
  market_location text NOT NULL,
  market_type text NOT NULL DEFAULT 'informal',
  date date NOT NULL DEFAULT CURRENT_DATE,
  price_change_pct numeric NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT market_prices_type_check CHECK (market_type IN ('formal','informal')),
  CONSTRAINT market_prices_unique UNIQUE (product, market_location, market_type, date)
);

GRANT SELECT ON public.market_prices TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_prices TO authenticated;
GRANT ALL ON public.market_prices TO service_role;

ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published market prices"
ON public.market_prices FOR SELECT
USING (published = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert market prices"
ON public.market_prices FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update market prices"
ON public.market_prices FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete market prices"
ON public.market_prices FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_market_prices_updated_at
BEFORE UPDATE ON public.market_prices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();