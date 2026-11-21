-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20260806004640; original ledger name: d1749350-ee86-417e-8624-4495790df179.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.


ALTER TABLE public.users ADD COLUMN IF NOT EXISTS load_capacity_kg numeric;

ALTER TABLE public.digital_contracts ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.users(id);
ALTER TABLE public.digital_contracts ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.users(id);

CREATE TABLE IF NOT EXISTS public.freight_loads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.users(id),
  driver_id uuid REFERENCES public.users(id),
  contract_id uuid REFERENCES public.digital_contracts(id),
  order_id uuid REFERENCES public.orders(id),
  product_id uuid REFERENCES public.products(id),
  product_name text NOT NULL,
  weight_kg numeric NOT NULL DEFAULT 0,
  origin_label text NOT NULL,
  origin_lat double precision,
  origin_lng double precision,
  destination_label text NOT NULL,
  destination_lat double precision,
  destination_lng double precision,
  pickup_date date,
  offered_price numeric,
  currency text NOT NULL DEFAULT 'Kz',
  status text NOT NULL DEFAULT 'agendado',
  notes text,
  accepted_at timestamptz,
  in_transit_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.freight_loads TO authenticated;
GRANT ALL ON public.freight_loads TO service_role;

ALTER TABLE public.freight_loads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view freight loads"
  ON public.freight_loads FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Owners can create freight loads"
  ON public.freight_loads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owner or assigned driver can update freight loads"
  ON public.freight_loads FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = driver_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = created_by OR auth.uid() = driver_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner or admin can delete freight loads"
  ON public.freight_loads FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_freight_loads_updated_at
  BEFORE UPDATE ON public.freight_loads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
