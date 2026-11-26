-- Private driver licence details stored separately from the public user profile.
CREATE TABLE IF NOT EXISTS public.driver_licenses (
  driver_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  license_number text NOT NULL,
  license_categories text[] NOT NULL DEFAULT '{}',
  issued_at date NOT NULL,
  expires_at date NOT NULL,
  issuing_authority text NOT NULL,
  verification_status text NOT NULL DEFAULT 'pending_review'
    CHECK (verification_status IN ('pending_review', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT driver_licenses_number_nonempty CHECK (length(btrim(license_number)) BETWEEN 3 AND 80),
  CONSTRAINT driver_licenses_categories_nonempty CHECK (cardinality(license_categories) > 0),
  CONSTRAINT driver_licenses_dates_valid CHECK (expires_at > issued_at),
  CONSTRAINT driver_licenses_authority_nonempty CHECK (length(btrim(issuing_authority)) BETWEEN 2 AND 160)
);

CREATE UNIQUE INDEX IF NOT EXISTS driver_licenses_number_normalized_uidx
  ON public.driver_licenses (upper(regexp_replace(license_number, '[[:space:]-]', '', 'g')));

ALTER TABLE public.driver_licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers can view own licence" ON public.driver_licenses;
CREATE POLICY "Drivers can view own licence"
  ON public.driver_licenses FOR SELECT TO authenticated
  USING (driver_id = (SELECT auth.uid()) OR public.is_agrilink_admin());

DROP POLICY IF EXISTS "Drivers can register own licence" ON public.driver_licenses;
CREATE POLICY "Drivers can register own licence"
  ON public.driver_licenses FOR INSERT TO authenticated
  WITH CHECK (
    driver_id = (SELECT auth.uid())
    AND verification_status = 'pending_review'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid()) AND u.user_type::text = 'motorista'
    )
  );

DROP POLICY IF EXISTS "Drivers can update own licence" ON public.driver_licenses;
CREATE POLICY "Drivers can update own licence"
  ON public.driver_licenses FOR UPDATE TO authenticated
  USING (driver_id = (SELECT auth.uid()))
  WITH CHECK (
    driver_id = (SELECT auth.uid())
    AND verification_status = 'pending_review'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
  );

DROP POLICY IF EXISTS "Admins can manage driver licences" ON public.driver_licenses;
CREATE POLICY "Admins can manage driver licences"
  ON public.driver_licenses FOR ALL TO authenticated
  USING (public.is_agrilink_admin())
  WITH CHECK (public.is_agrilink_admin());

GRANT SELECT, INSERT, UPDATE ON public.driver_licenses TO authenticated;
REVOKE ALL ON public.driver_licenses FROM anon;

CREATE OR REPLACE FUNCTION public.set_driver_license_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_driver_license_updated_at ON public.driver_licenses;
CREATE TRIGGER trg_driver_license_updated_at
  BEFORE UPDATE ON public.driver_licenses
  FOR EACH ROW EXECUTE FUNCTION public.set_driver_license_updated_at();
