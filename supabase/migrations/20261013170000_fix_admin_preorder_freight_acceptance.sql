-- Corrige a aceitação administrativa: não delega a uma RPC que rejeita pedidos
-- expirados e revalida o stock antes de voltar a reservar a quantidade.
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
  v_order public.pre_orders%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_load_id uuid;
  v_previous_status text;
  v_total numeric;
  v_available numeric;
BEGIN
  IF v_actor_id IS NULL OR NOT (
    public.has_admin_permission(v_actor_id, 'manage_orders'::public.admin_permission)
    OR public.is_support_agent(v_actor_id)
  ) THEN
    RAISE EXCEPTION 'Permission denied to manage orders' USING ERRCODE = '42501';
  END IF;

  IF p_order_id IS NULL OR p_freight_price IS NULL
     OR p_freight_price < 0 OR p_freight_price > 1000000000000 THEN
    RAISE EXCEPTION 'Preço de frete inválido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_order
  FROM public.pre_orders po
  WHERE po.id = p_order_id AND po.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pré-compra não encontrada ou removida para a lixeira' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.status NOT IN ('pending', 'aguardando', 'expired') THEN
    RAISE EXCEPTION 'PRE_ORDER_STATUS_NOT_ELIGIBLE: estado actual %', v_order.status USING ERRCODE = '22023';
  END IF;
  IF v_order.payment_status IS DISTINCT FROM 'unpaid' THEN
    RAISE EXCEPTION 'PRE_ORDER_PAYMENT_STATE_INVALID: só é possível aceitar pré-compras ainda não pagas' USING ERRCODE = '22023';
  END IF;
  IF v_order.quantity IS NULL OR v_order.quantity <= 0 THEN
    RAISE EXCEPTION 'PRE_ORDER_QUANTITY_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_product
  FROM public.products p
  WHERE p.id = v_order.product_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_product.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'PRODUCT_NOT_AVAILABLE: o produto já não está activo' USING ERRCODE = '22023';
  END IF;
  IF v_product.price IS NULL OR v_product.price < 0 THEN
    RAISE EXCEPTION 'PRODUCT_PRICE_UNAVAILABLE' USING ERRCODE = '22023';
  END IF;

  -- Se a reserva expirou, validar novamente a quantidade contra o stock
  -- disponível, descontando outras reservas mas permitindo reutilizar a própria.
  IF v_order.stock_reserved IS TRUE THEN
    IF coalesce(v_product.reserved_quantity, 0) < v_order.quantity THEN
      RAISE EXCEPTION 'PRE_ORDER_RESERVATION_INCONSISTENT: a reserva já não corresponde ao stock' USING ERRCODE = '22023';
    END IF;
    v_available := coalesce(v_product.quantity, 0)
      - greatest(coalesce(v_product.reserved_quantity, 0) - v_order.quantity, 0);
    IF v_available < v_order.quantity THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK: stock disponível insuficiente para revalidar a pré-compra' USING ERRCODE = '22023';
    END IF;
  ELSE
    v_available := coalesce(v_product.quantity, 0) - coalesce(v_product.reserved_quantity, 0);
    IF v_available < v_order.quantity THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK: stock disponível insuficiente para revalidar a pré-compra' USING ERRCODE = '22023';
    END IF;
    UPDATE public.products
    SET reserved_quantity = coalesce(reserved_quantity, 0) + v_order.quantity,
        updated_at = now()
    WHERE products.id = v_product.id;
  END IF;

  v_previous_status := v_order.status;
  v_total := v_order.quantity * v_product.price;

  -- O trigger de consumo de reserva confirma o stock atomicamente; o trigger
  -- logístico cria (ou reutiliza) a carga associada à pré-compra aceite.
  UPDATE public.pre_orders po
  SET status = 'accepted',
      unit_price = v_product.price,
      total_price = v_total,
      stock_reserved = true,
      reservation_expires_at = now() + interval '5 minutes',
      updated_at = now()
  WHERE po.id = p_order_id
  RETURNING po.* INTO v_order;

  SELECT fl.id INTO v_load_id
  FROM public.freight_loads fl
  WHERE fl.pre_order_id = p_order_id
  ORDER BY fl.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_load_id IS NULL THEN
    RAISE EXCEPTION 'FREIGHT_LOAD_CREATION_FAILED: a carga logística não foi criada' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.freight_loads fl
  SET offered_price = p_freight_price,
      updated_at = now(),
      notes = concat_ws(E'\n', nullif(fl.notes, ''), 'Frete definido pela administração da AgriLink.')
  WHERE fl.id = v_load_id;

  UPDATE public.orders o
  SET transport_fee = p_freight_price,
      updated_at = now()
  WHERE o.pre_order_id = p_order_id;

  INSERT INTO public.audit_logs(event_type, action, user_id, details)
  VALUES (
    'PRE_ORDER_STATUS_CHANGED',
    'ADMIN_ACCEPTED_PRE_ORDER_AND_SET_FREIGHT',
    v_actor_id,
    jsonb_build_object(
      'pre_order_id', p_order_id,
      'previous_status', v_previous_status,
      'new_status', 'accepted',
      'freight_load_id', v_load_id,
      'freight_price', p_freight_price,
      'unit_price', v_order.unit_price,
      'total_price', v_order.total_price,
      'stock_revalidated', v_previous_status = 'expired' OR v_order.reservation_expires_at IS NULL
    )
  );

  RETURN QUERY SELECT v_order.id, v_order.status::text, coalesce(v_order.updated_at, now());
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_accept_pre_order_with_freight(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_accept_pre_order_with_freight(uuid, numeric) TO authenticated;
