BEGIN;

DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios pre-orders" ON public.pre_orders;
DROP POLICY IF EXISTS "Assistentes podem atualizar status dos pre-orders" ON public.pre_orders;
REVOKE UPDATE ON TABLE public.pre_orders FROM PUBLIC, anon, authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.pre_orders FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_pre_order(
  p_order_id UUID,
  p_status TEXT
)
RETURNS TABLE (
  id UUID,
  status TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_order public.pre_orders%ROWTYPE;
  v_product_owner_id UUID;
  v_previous_status TEXT;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_order_id IS NULL OR p_status IS NULL OR p_status NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid producer response' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_order
  FROM public.pre_orders AS pre_order
  WHERE pre_order.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pre-order not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT product.user_id INTO v_product_owner_id
  FROM public.products AS product
  WHERE product.id = v_order.product_id;

  IF v_product_owner_id IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'Only the product owner can respond to this pre-order' USING ERRCODE = '42501';
  END IF;
  IF v_order.status NOT IN ('pending', 'aguardando') THEN
    RAISE EXCEPTION 'Only pending pre-orders can receive a producer response' USING ERRCODE = '22023';
  END IF;

  v_previous_status := v_order.status;
  UPDATE public.pre_orders AS pre_order
  SET status = p_status,
      updated_at = NOW()
  WHERE pre_order.id = p_order_id
  RETURNING pre_order.* INTO v_order;

  INSERT INTO public.audit_logs (event_type, action, user_id, details)
  VALUES (
    'PRE_ORDER_STATUS_CHANGED',
    'PRODUCER_PRE_ORDER_RESPONDED',
    v_actor_id,
    jsonb_build_object(
      'pre_order_id', p_order_id,
      'previous_status', v_previous_status,
      'new_status', p_status
    )
  );

  RETURN QUERY SELECT v_order.id, v_order.status, COALESCE(v_order.updated_at, NOW());
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_pre_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_pre_order(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_pre_order_status(
  p_order_id UUID,
  p_status TEXT
)
RETURNS TABLE (
  id UUID,
  status TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_order public.pre_orders%ROWTYPE;
  v_previous_status TEXT;
BEGIN
  IF v_actor_id IS NULL OR NOT (
    public.has_admin_permission(v_actor_id, 'manage_orders'::public.admin_permission)
    OR public.is_support_agent(v_actor_id)
  ) THEN
    RAISE EXCEPTION 'Permission denied to manage orders' USING ERRCODE = '42501';
  END IF;

  IF p_order_id IS NULL OR p_status IS NULL
     OR p_status NOT IN ('pending', 'accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid pre-order status update' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_order
  FROM public.pre_orders AS pre_order
  WHERE pre_order.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pre-order not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.status IN ('completed', 'cancelled', 'concluida', 'cancelado') THEN
    RAISE EXCEPTION 'Final pre-orders cannot be changed' USING ERRCODE = '22023';
  END IF;

  v_previous_status := v_order.status;
  IF v_previous_status IS DISTINCT FROM p_status THEN
    UPDATE public.pre_orders AS pre_order
    SET status = p_status,
        updated_at = NOW()
    WHERE pre_order.id = p_order_id
    RETURNING pre_order.* INTO v_order;

    INSERT INTO public.audit_logs (event_type, action, user_id, details)
    VALUES (
      'PRE_ORDER_STATUS_CHANGED',
      'ADMIN_PRE_ORDER_STATUS_CHANGED',
      v_actor_id,
      jsonb_build_object(
        'pre_order_id', p_order_id,
        'previous_status', v_previous_status,
        'new_status', p_status
      )
    );
  END IF;

  RETURN QUERY SELECT v_order.id, v_order.status, COALESCE(v_order.updated_at, NOW());
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_pre_order_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_pre_order_status(uuid, text) TO authenticated;

COMMIT;