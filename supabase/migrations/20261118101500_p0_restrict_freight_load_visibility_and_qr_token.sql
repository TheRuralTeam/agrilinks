-- Restrict freight-load row visibility to public marketplace listings and legitimate participants.
-- Keep the public listing limited to unassigned loads; retain private access for participants and staff.

BEGIN;

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

-- QR tokens are capability-like identifiers. Return one only after verifying
-- that the caller is a participant or an explicitly authorized staff member.
CREATE OR REPLACE FUNCTION public.get_freight_load_qr_token(p_freight_load_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_load public.freight_loads%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT fl.*
    INTO v_load
  FROM public.freight_loads AS fl
  WHERE fl.id = p_freight_load_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Carga não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    v_load.created_by = v_actor
    OR v_load.driver_id = v_actor
    OR v_load.supplier_id = v_actor
    OR v_load.buyer_id = v_actor
    OR public.is_agrilink_admin()
    OR public.has_role(v_actor, 'admin'::public.app_role)
    OR public.has_role(v_actor, 'support_agent'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.products AS p
      WHERE p.id = v_load.product_id
        AND p.user_id = v_actor
    )
    OR EXISTS (
      SELECT 1
      FROM public.pre_orders AS po
      WHERE po.id = v_load.pre_order_id
        AND po.user_id = v_actor
    )
    OR EXISTS (
      SELECT 1
      FROM public.orders AS o
      WHERE o.id = v_load.order_id
        AND o.user_id = v_actor
    )
  ) THEN
    RAISE EXCEPTION 'Não tem permissão para consultar o QR desta carga' USING ERRCODE = '42501';
  END IF;

  RETURN v_load.qr_token;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_freight_load_qr_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_freight_load_qr_token(uuid) TO authenticated;

COMMIT;
