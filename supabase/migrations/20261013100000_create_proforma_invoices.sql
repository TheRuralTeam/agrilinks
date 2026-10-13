BEGIN;

CREATE TABLE IF NOT EXISTS public.proforma_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL UNIQUE,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  expected_delivery_date DATE,
  customer_name TEXT NOT NULL CHECK (length(trim(customer_name)) > 0),
  customer_email TEXT,
  customer_phone TEXT,
  customer_tax_id TEXT,
  delivery_location TEXT,
  sourcing_reference TEXT,
  payment_terms TEXT,
  notes TEXT,
  currency TEXT NOT NULL DEFAULT 'AOA' CHECK (currency = 'AOA'),
  products_subtotal NUMERIC(18,2) NOT NULL CHECK (products_subtotal >= 0),
  freight_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (freight_amount >= 0),
  grand_total NUMERIC(18,2) NOT NULL CHECK (grand_total >= 0),
  items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0),
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'accepted', 'rejected', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT proforma_validity_after_issue CHECK (valid_until IS NULL OR valid_until >= issue_date),
  CONSTRAINT proforma_delivery_after_issue CHECK (expected_delivery_date IS NULL OR expected_delivery_date >= issue_date),
  CONSTRAINT proforma_total_matches CHECK (grand_total = products_subtotal + freight_amount)
);

CREATE INDEX IF NOT EXISTS proforma_invoices_issuer_created_idx
  ON public.proforma_invoices (issuer_id, created_at DESC);

ALTER TABLE public.proforma_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proforma_invoices FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.proforma_invoices FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.proforma_invoices TO authenticated;

DROP POLICY IF EXISTS "Issuer can view own proforma invoices" ON public.proforma_invoices;
CREATE POLICY "Issuer can view own proforma invoices"
  ON public.proforma_invoices FOR SELECT TO authenticated
  USING (issuer_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Issuer can create own proforma invoices" ON public.proforma_invoices;
CREATE POLICY "Issuer can create own proforma invoices"
  ON public.proforma_invoices FOR INSERT TO authenticated
  WITH CHECK (issuer_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Issuer can update own proforma invoices" ON public.proforma_invoices;
CREATE POLICY "Issuer can update own proforma invoices"
  ON public.proforma_invoices FOR UPDATE TO authenticated
  USING (issuer_id = (SELECT auth.uid()))
  WITH CHECK (issuer_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Issuer can delete own proforma invoices" ON public.proforma_invoices;
CREATE POLICY "Issuer can delete own proforma invoices"
  ON public.proforma_invoices FOR DELETE TO authenticated
  USING (issuer_id = (SELECT auth.uid()));

COMMENT ON TABLE public.proforma_invoices IS
  'Propostas comerciais proforma AgriLink. Items e preços são snapshots no momento da emissão; acesso restrito ao emissor por RLS.';

COMMIT;
