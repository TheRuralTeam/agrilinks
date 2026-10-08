CREATE OR REPLACE FUNCTION public.admin_remove_pre_order(p_order_id uuid, p_reason text DEFAULT NULL::text)
RETURNS TABLE(id uuid, deleted_at timestamptz, deleted_until timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_order public.pre_orders%ROWTYPE;
  v_deleted_at timestamptz;
  v_deleted_until timestamptz;
BEGIN
  IF v_actor IS NULL
     OR NOT (
       public.has_admin_permission(v_actor, 'manage_orders'::public.admin_permission)
       OR public.is_support_agent(v_actor)
     ) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT po.*
  INTO v_order
  FROM public.pre_orders AS po
  WHERE po.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pre-order not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.deleted_at IS NOT NULL THEN
    RETURN QUERY SELECT v_order.id, v_order.deleted_at, v_order.deleted_until;
    RETURN;
  END IF;

  IF v_order.status IN ('accepted', 'completed', 'concluida')
     OR v_order.payment_status IN ('paid', 'pending', 'partially_refunded') THEN
    RAISE EXCEPTION 'PAID_OR_ACTIVE_ORDER_CANNOT_BE_REMOVED' USING ERRCODE = '22023';
  END IF;

  IF v_order.stock_reserved THEN
    IF v_order.product_id IS NULL THEN
      RAISE EXCEPTION 'RESERVED_ORDER_PRODUCT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    PERFORM 1
    FROM public.products AS p
    WHERE p.id = v_order.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'RESERVED_ORDER_PRODUCT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.products AS p
    SET quantity = p.quantity + v_order.quantity,
        reserved_quantity = GREATEST(COALESCE(p.reserved_quantity, 0) - v_order.quantity, 0),
        status = CASE
          WHEN p.status = 'removed' AND p.quantity + v_order.quantity > 0 THEN 'active'
          ELSE p.status
        END,
        updated_at = now()
    WHERE p.id = v_order.product_id;
  END IF;

  v_deleted_at := now();
  v_deleted_until := v_deleted_at + interval '15 days';

  UPDATE public.pre_orders AS po
  SET deleted_at = v_deleted_at,
      deleted_until = v_deleted_until,
      deleted_by = v_actor,
      deletion_reason = COALESCE(NULLIF(btrim(p_reason), ''), 'Removido pelo administrador'),
      stock_reserved = false,
      reservation_expires_at = NULL,
      updated_at = v_deleted_at
  WHERE po.id = p_order_id;

  INSERT INTO public.audit_logs(event_type, action, user_id, details)
  VALUES (
    'PRE_ORDER_MOVED_TO_TRASH',
    'ADMIN_PRE_ORDER_REMOVED',
    v_actor,
    jsonb_build_object(
      'pre_order_id', p_order_id,
      'deleted_until', v_deleted_until,
      'reason', COALESCE(NULLIF(btrim(p_reason), ''), 'Removido pelo administrador')
    )
  );

  RETURN QUERY SELECT p_order_id, v_deleted_at, v_deleted_until;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_remove_pre_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_pre_order(uuid, text) TO authenticated;