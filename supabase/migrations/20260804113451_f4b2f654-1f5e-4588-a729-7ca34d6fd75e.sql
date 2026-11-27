CREATE TABLE public.futures_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  producer_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ficha_id uuid REFERENCES public.fichas_recebimento(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity numeric NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  quality_specs text,
  packaging text,
  transport text,
  delivery_date date NOT NULL,
  proposed_price numeric NOT NULL,
  agreed_price numeric,
  currency text NOT NULL DEFAULT 'AOA',
  province_id text,
  municipality_id text,
  delivery_location text,
  description text,
  status text NOT NULL DEFAULT 'pending_match',
  match_notes text,
  admin_notes text,
  penalty_percentage numeric NOT NULL DEFAULT 10,
  terms_version text NOT NULL DEFAULT 'v1',
  terms_accepted_at timestamptz,
  buyer_signature_name text,
  producer_confirmed_at timestamptz,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.futures_contracts TO authenticated;
GRANT ALL ON public.futures_contracts TO service_role;

ALTER TABLE public.futures_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers manage own futures contracts"
ON public.futures_contracts FOR SELECT TO authenticated
USING (auth.uid() = buyer_id);

CREATE POLICY "Buyers create futures contracts"
ON public.futures_contracts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Buyers update own futures contracts"
ON public.futures_contracts FOR UPDATE TO authenticated
USING (auth.uid() = buyer_id)
WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Producers view assigned futures contracts"
ON public.futures_contracts FOR SELECT TO authenticated
USING (auth.uid() = producer_id);

CREATE POLICY "Producers update assigned futures contracts"
ON public.futures_contracts FOR UPDATE TO authenticated
USING (auth.uid() = producer_id)
WITH CHECK (auth.uid() = producer_id);

CREATE POLICY "Admins view all futures contracts"
ON public.futures_contracts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Admins manage all futures contracts"
ON public.futures_contracts FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete futures contracts"
ON public.futures_contracts FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_futures_contracts_updated_at
BEFORE UPDATE ON public.futures_contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_futures_contracts_buyer ON public.futures_contracts(buyer_id);
CREATE INDEX idx_futures_contracts_producer ON public.futures_contracts(producer_id);
CREATE INDEX idx_futures_contracts_status ON public.futures_contracts(status);