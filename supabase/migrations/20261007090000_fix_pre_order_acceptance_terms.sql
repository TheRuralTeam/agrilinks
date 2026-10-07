-- Fix pre-order acceptance so the accepted commercial terms are persisted server-side.
-- The product price at acceptance becomes the pre-order unit price used by
-- notifications, email and subsequent payment flows.

CREATE OR REPLACE FUNCTION public.respond_to_pre_order(p_order_id uuid, p_status text)
RETURNS TABLE(id uuid, status text, updated_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_order public.pre_orders%ROWTYPE;
  v_product_owner_id uuid;
  v_product_price numeric;
  v_previous_status text;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_order_id IS NULL OR p_status IS NULL OR p_status NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid producer response' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_order
  FROM public.pre_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pre-order not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT p.user_id, p.price
  INTO v_product_owner_id, v_product_price
  FROM public.products p
  WHERE p.id = v_order.product_id
  FOR UPDATE;

  IF v_product_owner_id IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'Only the product owner can respond to this pre-order' USING ERRCODE = '42501';
  END IF;

  IF v_order.status NOT IN ('pending', 'aguardando') THEN
    RAISE EXCEPTION 'Only pending pre-orders can receive a producer response' USING ERRCODE = '22023';
  END IF;

  IF p_status = 'accepted' AND (v_product_price IS NULL OR v_product_price < 0) THEN
    RAISE EXCEPTION 'PRODUCT_PRICE_UNAVAILABLE: O produto não tem preço válido para aceitar a pré-compra'
      USING ERRCODE = '22023';
  END IF;

  v_previous_status := v_order.status;

  UPDATE public.pre_orders
  SET
    status = p_status,
    unit_price = CASE WHEN p_status = 'accepted' THEN v_product_price ELSE unit_price END,
    updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO public.audit_logs (event_type, action, user_id, details)
  VALUES (
    'PRE_ORDER_STATUS_CHANGED',
    'PRODUCER_PRE_ORDER_RESPONDED',
    v_actor_id,
    jsonb_build_object(
      'pre_order_id', p_order_id,
      'previous_status', v_previous_status,
      'new_status', p_status,
      'unit_price', CASE WHEN p_status = 'accepted' THEN v_product_price ELSE v_order.unit_price END
    )
  );

  RETURN QUERY SELECT v_order.id, v_order.status::text, coalesce(v_order.updated_at, now());
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_pre_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_pre_order(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_pre_order_status(p_order_id uuid, p_status text)
RETURNS TABLE(id uuid, status text, updated_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_order public.pre_orders%ROWTYPE;
  v_product_price numeric;
BEGIN
  IF v_actor_id IS NULL OR NOT (
    public.is_root_admin(v_actor_id)
    OR public.is_super_root(v_actor_id)
    OR public.has_admin_permission(v_actor_id, 'manage_orders'::public.admin_permission)
    OR public.has_role(v_actor_id, 'support_agent'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF p_order_id IS NULL OR p_status IS NULL OR p_status <> 'accepted' THEN
    RAISE EXCEPTION 'Invalid administrative status' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_order
  FROM public.pre_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pre-order not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This pre-order is in the trash and cannot be accepted' USING ERRCODE = '22023';
  END IF;

  IF v_order.status NOT IN ('pending', 'aguardando') THEN
    RAISE EXCEPTION 'Only pending pre-orders can be accepted' USING ERRCODE = '22023';
  END IF;

  SELECT p.price
  INTO v_product_price
  FROM public.products p
  WHERE p.id = v_order.product_id
  FOR UPDATE;

  IF v_product_price IS NULL OR v_product_price < 0 THEN
    RAISE EXCEPTION 'PRODUCT_PRICE_UNAVAILABLE: O produto não tem preço válido para aceitar a pré-compra'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.pre_orders
  SET
    status = 'accepted',
    unit_price = v_product_price,
    updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO public.audit_logs (event_type, action, user_id, details)
  VALUES (
    'PRE_ORDER_STATUS_CHANGED',
    'ADMIN_PRE_ORDER_ACCEPTED',
    v_actor_id,
    jsonb_build_object(
      'pre_order_id', p_order_id,
      'new_status', 'accepted',
      'unit_price', v_product_price
    )
  );

  RETURN QUERY SELECT v_order.id, v_order.status::text, coalesce(v_order.updated_at, now());
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_pre_order_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_pre_order_status(uuid, text) TO authenticated;
