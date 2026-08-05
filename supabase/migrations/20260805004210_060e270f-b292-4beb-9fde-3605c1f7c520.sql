CREATE TABLE public.digital_contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type text NOT NULL CHECK (source_type IN ('ficha','product')),
  source_id uuid NOT NULL,
  requested_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  buyer_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity numeric,
  unit text NOT NULL DEFAULT 'kg',
  price numeric,
  currency text NOT NULL DEFAULT 'Kz',
  delivery_terms text,
  conditions text,
  status text NOT NULL DEFAULT 'pending_admin',
  admin_notes text,
  approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.digital_contracts TO authenticated;
GRANT UPDATE, DELETE ON public.digital_contracts TO authenticated;
GRANT ALL ON public.digital_contracts TO service_role;

ALTER TABLE public.digital_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties can view their contracts"
ON public.digital_contracts FOR SELECT TO authenticated
USING (
  auth.uid() = requested_by
  OR auth.uid() = buyer_id
  OR auth.uid() = supplier_id
  OR public.has_role(auth.uid(), 'admin')
  OR public.is_root_admin(auth.uid())
);

CREATE POLICY "Users can request contracts"
ON public.digital_contracts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = requested_by AND status = 'pending_admin');

CREATE POLICY "Admins can update contracts"
ON public.digital_contracts FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_root_admin(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_root_admin(auth.uid()));

CREATE POLICY "Admins can delete contracts"
ON public.digital_contracts FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_root_admin(auth.uid()));

CREATE TRIGGER update_digital_contracts_updated_at
BEFORE UPDATE ON public.digital_contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_digital_contracts_buyer ON public.digital_contracts(buyer_id);
CREATE INDEX idx_digital_contracts_supplier ON public.digital_contracts(supplier_id);
CREATE INDEX idx_digital_contracts_status ON public.digital_contracts(status);