-- Aceitação administrativa de pré-compra e definição do frete numa única transacção.
-- Reutiliza a RPC administrativa existente para manter validação de stock, reserva e auditoria.
CREATE OR REPLACE FUNCTION public.admin_accept_pre_order_with_freight(
  p_order_id uuid,
  p_freight_price numeric
)
RETURNS TABLE(id uuid, status text, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_result record;
  v_load_id uuid;
BEGIN
  IF v_actor_id IS NULL OR NOT (
    public.has_admin_permission(v_actor_id, 'manage_orders'::public.admin_permission)
    OR public.is_support_agent(v_actor_id)
  ) THEN
    RAISE EXCEPTION 'Permission denied to manage orders' USING ERRCODE = '42501';
  END IF;
  IF p_order_id IS NULL OR p_freight_price IS NULL OR p_freight_price < 0
     OR p_freight_price > 1000000000000 THEN
    RAISE EXCEPTION 'Preço de frete inválido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_result
  FROM public.admin_update_pre_order_status(p_order_id, 'accepted');
  IF v_result.id IS NULL OR v_result.status <> 'accepted' THEN
    RAISE EXCEPTION 'A pré-compra não foi aceite. Estado actual: %', coalesce(v_result.status, 'desconhecido')
      USING ERRCODE = '22023';
  END IF;

  SELECT fl.id INTO v_load_id
  FROM public.freight_loads fl
  WHERE fl.pre_order_id = p_order_id
  ORDER BY fl.created_at DESC
  LIMIT 1
  FOR UPDATE;
  IF v_load_id IS NULL THEN
    RAISE EXCEPTION 'Carga logística não encontrada para esta pré-compra' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.freight_loads
  SET offered_price = p_freight_price,
      updated_at = now(),
      notes = concat_ws(E'\n', nullif(notes, ''), 'Frete definido pela administração da AgriLink.')
  WHERE freight_loads.id = v_load_id;

  UPDATE public.orders
  SET transport_fee = p_freight_price,
      updated_at = now()
  WHERE pre_order_id = p_order_id;

  INSERT INTO public.audit_logs(event_type, action, user_id, details)
  VALUES (
    'PRE_ORDER_ACCEPTED_WITH_FREIGHT',
    'ADMIN_ACCEPTED_PRE_ORDER_AND_SET_FREIGHT',
    v_actor_id,
    jsonb_build_object('pre_order_id', p_order_id, 'freight_load_id', v_load_id, 'freight_price', p_freight_price)
  );
  RETURN QUERY SELECT v_result.id, v_result.status::text, coalesce(v_result.updated_at, now());
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_accept_pre_order_with_freight(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_accept_pre_order_with_freight(uuid, numeric) TO authenticated;
