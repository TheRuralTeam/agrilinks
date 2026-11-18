-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261004130000; original ledger name: pre_order_buyer_cancellation.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

CREATE OR REPLACE FUNCTION public.cancel_pre_order(p_order_id UUID)
RETURNS TABLE (
  id UUID,
  status TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id UUID := auth.uid();
  v_order public.pre_orders%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_order
  FROM public.pre_orders
  WHERE public.pre_orders.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.user_id <> v_actor_id THEN
    RAISE EXCEPTION 'Pre-order not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending pre-orders can be cancelled by the buyer'
      USING ERRCODE = '22023';
  END IF;

  IF v_order.created_at IS NULL OR v_order.created_at < NOW() - INTERVAL '3 hours' THEN
    RAISE EXCEPTION 'The cancellation period has expired'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.pre_orders
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE public.pre_orders.id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO public.audit_logs (event_type, action, user_id, details)
  VALUES (
    'PRE_ORDER_STATUS_CHANGED',
    'BUYER_PRE_ORDER_CANCELLED',
    v_actor_id,
    jsonb_build_object(
      'pre_order_id', v_order.id,
      'previous_status', 'pending',
      'new_status', 'cancelled'
    )
  );

  RETURN QUERY SELECT v_order.id, v_order.status, COALESCE(v_order.updated_at, NOW());
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_pre_order(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.cancel_pre_order(UUID) TO authenticated;
