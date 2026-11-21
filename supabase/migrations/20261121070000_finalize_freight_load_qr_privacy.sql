BEGIN;

-- Switch the insert trigger to generate a private token without depending on the legacy public column.
CREATE OR REPLACE FUNCTION private.create_freight_load_qr_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO private.freight_load_qr_tokens (freight_load_id)
  VALUES (NEW.id)
  ON CONFLICT (freight_load_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.create_freight_load_qr_token() FROM PUBLIC, anon, authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated can view freight loads" ON public.freight_loads;
DROP POLICY IF EXISTS "Freight participants can read their loads" ON public.freight_loads;

CREATE POLICY "Marketplace and freight participants can read loads"
ON public.freight_loads
FOR SELECT
TO authenticated
USING (
  (
    status IN ('available', 'open', 'agendado')
    AND driver_id IS NULL
  )
  OR created_by = (SELECT auth.uid())
  OR driver_id = (SELECT auth.uid())
  OR supplier_id = (SELECT auth.uid())
  OR buyer_id = (SELECT auth.uid())
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'support_agent'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.pre_orders AS po
    WHERE po.id = freight_loads.pre_order_id
      AND po.user_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM public.orders AS o
    WHERE o.id = freight_loads.order_id
      AND o.user_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM public.products AS p
    WHERE p.id = freight_loads.product_id
      AND p.user_id = (SELECT auth.uid())
  )
);

-- Anonymous users do not create or read freight loads. Authenticated users retain only the app's read/insert access.
REVOKE ALL ON TABLE public.freight_loads FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.freight_loads TO authenticated;

ALTER TABLE public.freight_loads DROP COLUMN qr_token;

DO $$
DECLARE
  v_load_count integer;
  v_token_count integer;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'freight_loads'
      AND column_name = 'qr_token'
  ) THEN
    RAISE EXCEPTION 'Legacy public QR-token column still exists';
  END IF;

  SELECT count(*)::integer INTO v_load_count FROM public.freight_loads;
  SELECT count(*)::integer INTO v_token_count FROM private.freight_load_qr_tokens;

  IF v_load_count <> v_token_count THEN
    RAISE EXCEPTION 'Private QR-token count mismatch: % freight loads, % private tokens',
      v_load_count, v_token_count;
  END IF;
END;
$$;

COMMIT;
