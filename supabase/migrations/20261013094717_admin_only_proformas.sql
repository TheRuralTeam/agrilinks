BEGIN;

-- Só administradores e administradores-raiz podem consultar ou gerir proformas.
DROP POLICY IF EXISTS "Issuer can view own proforma invoices" ON public.proforma_invoices;
DROP POLICY IF EXISTS "Issuer can create own proforma invoices" ON public.proforma_invoices;
DROP POLICY IF EXISTS "Issuer can update own proforma invoices" ON public.proforma_invoices;
DROP POLICY IF EXISTS "Issuer can delete own proforma invoices" ON public.proforma_invoices;
DROP POLICY IF EXISTS "Administrators can view proforma invoices" ON public.proforma_invoices;
DROP POLICY IF EXISTS "Administrators can create proforma invoices" ON public.proforma_invoices;
DROP POLICY IF EXISTS "Administrators can update proforma invoices" ON public.proforma_invoices;
DROP POLICY IF EXISTS "Administrators can delete proforma invoices" ON public.proforma_invoices;

CREATE POLICY "Administrators can view proforma invoices"
  ON public.proforma_invoices FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR public.is_root_admin((SELECT auth.uid()))
    OR public.is_super_root((SELECT auth.uid()))
  );

CREATE POLICY "Administrators can create proforma invoices"
  ON public.proforma_invoices FOR INSERT TO authenticated
  WITH CHECK (
    issuer_id = (SELECT auth.uid())
    AND (
      public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
      OR public.is_root_admin((SELECT auth.uid()))
      OR public.is_super_root((SELECT auth.uid()))
    )
  );

CREATE POLICY "Administrators can update proforma invoices"
  ON public.proforma_invoices FOR UPDATE TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR public.is_root_admin((SELECT auth.uid()))
    OR public.is_super_root((SELECT auth.uid()))
  )
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR public.is_root_admin((SELECT auth.uid()))
    OR public.is_super_root((SELECT auth.uid()))
  );

CREATE POLICY "Administrators can delete proforma invoices"
  ON public.proforma_invoices FOR DELETE TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR public.is_root_admin((SELECT auth.uid()))
    OR public.is_super_root((SELECT auth.uid()))
  );

COMMIT;
