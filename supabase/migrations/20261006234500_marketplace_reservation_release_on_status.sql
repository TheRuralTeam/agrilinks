-- Smart marketplace stock reservation lifecycle.
-- Reservations are created atomically by the database RPC, expire after 15 minutes,
-- return stock on cancellation/rejection/expiry, and are consumed on acceptance/completion.

CREATE OR REPLACE FUNCTION public.release_marketplace_reservation_on_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('rejected','cancelled','expired') AND NEW.stock_reserved THEN
    PERFORM public.release_marketplace_reservation(NEW.id, NEW.status = 'expired');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_marketplace_reservation ON public.pre_orders;
CREATE TRIGGER trg_release_marketplace_reservation
AFTER UPDATE OF status ON public.pre_orders
FOR EACH ROW
WHEN (NEW.status IN ('rejected','cancelled','expired') AND NEW.stock_reserved = true)
EXECUTE FUNCTION public.release_marketplace_reservation_on_status();

CREATE OR REPLACE FUNCTION public.cancel_pre_order(p_order_id uuid)
RETURNS TABLE(id uuid,status text,updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_order public.pre_orders%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_order FROM public.pre_orders WHERE id=p_order_id FOR UPDATE;

  IF NOT FOUND OR v_order.user_id <> v_actor_id THEN
    RAISE EXCEPTION 'Pre-order not found' USING ERRCODE='P0002';
  END IF;

  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending pre-orders can be cancelled by the buyer' USING ERRCODE='22023';
  END IF;

  UPDATE public.pre_orders
  SET status='cancelled', updated_at=now()
  WHERE id=p_order_id
  RETURNING * INTO v_order;

  INSERT INTO public.audit_logs(event_type,action,user_id,details)
  VALUES(
    'PRE_ORDER_STATUS_CHANGED',
    'BUYER_PRE_ORDER_CANCELLED',
    v_actor_id,
    jsonb_build_object('pre_order_id',v_order.id,'previous_status','pending','new_status','cancelled')
  );

  RETURN QUERY SELECT v_order.id,v_order.status,coalesce(v_order.updated_at,now());
END;
$$;
