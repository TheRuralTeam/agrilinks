BEGIN;

ALTER TABLE public.freight_loads
  ADD COLUMN IF NOT EXISTS qr_token text;

UPDATE public.freight_loads
SET qr_token = replace(gen_random_uuid()::text, '-', '')
WHERE qr_token IS NULL;

ALTER TABLE public.freight_loads
  ALTER COLUMN qr_token SET DEFAULT replace(gen_random_uuid()::text, '-', ''),
  ALTER COLUMN qr_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_freight_loads_qr_token
  ON public.freight_loads(qr_token);

CREATE OR REPLACE FUNCTION public.get_freight_load_qr_details(p_qr_token text)
RETURNS TABLE(
  id uuid,
  display_id text,
  qr_token text,
  product_name text,
  weight_kg numeric,
  origin_label text,
  destination_label text,
  pickup_date date,
  offered_price numeric,
  currency text,
  status text,
  notes text,
  route_distance_km numeric,
  route_duration_minutes integer,
  pre_order_id uuid,
  order_display_id text,
  order_status text,
  payment_status text,
  buyer_name text,
  buyer_phone text,
  driver_name text,
  driver_phone text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_load public.freight_loads%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT fl.* INTO v_load
  FROM public.freight_loads fl
  WHERE fl.qr_token = p_qr_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Carga não encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    v_load.created_by = v_actor
    OR v_load.driver_id = v_actor
    OR public.has_role(v_actor, 'admin'::public.app_role)
    OR public.has_role(v_actor, 'support_agent'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = v_load.product_id AND p.user_id = v_actor
    )
    OR EXISTS (
      SELECT 1 FROM public.pre_orders po
      WHERE po.id = v_load.pre_order_id AND po.user_id = v_actor
    )
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = v_load.order_id AND o.user_id = v_actor
    )
  ) THEN
    RAISE EXCEPTION 'Não tem permissão para consultar esta carga' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    v_load.id,
    left(v_load.id::text, 13),
    v_load.qr_token,
    v_load.product_name,
    v_load.weight_kg,
    v_load.origin_label,
    v_load.destination_label,
    v_load.pickup_date,
    v_load.offered_price,
    v_load.currency,
    v_load.status,
    v_load.notes,
    v_load.route_distance_km,
    v_load.route_duration_minutes,
    v_load.pre_order_id,
    CASE
      WHEN v_load.pre_order_id IS NOT NULL THEN left(v_load.pre_order_id::text, 13)
      WHEN v_load.order_id IS NOT NULL THEN left(v_load.order_id::text, 13)
      ELSE NULL
    END,
    COALESCE(
      (SELECT po.status FROM public.pre_orders po WHERE po.id = v_load.pre_order_id),
      (SELECT o.status::text FROM public.orders o WHERE o.id = v_load.order_id)
    ),
    (SELECT po.payment_status FROM public.pre_orders po WHERE po.id = v_load.pre_order_id),
    (SELECT u.full_name
       FROM public.pre_orders po
       JOIN public.users u ON u.id = po.user_id
      WHERE po.id = v_load.pre_order_id),
    (SELECT u.phone
       FROM public.pre_orders po
       JOIN public.users u ON u.id = po.user_id
      WHERE po.id = v_load.pre_order_id),
    (SELECT u.full_name FROM public.users u WHERE u.id = v_load.driver_id),
    (SELECT u.phone FROM public.users u WHERE u.id = v_load.driver_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_freight_load_qr_details(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_freight_load_qr_details(text) TO authenticated;

COMMIT;