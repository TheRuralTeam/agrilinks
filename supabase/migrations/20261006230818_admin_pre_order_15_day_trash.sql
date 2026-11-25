-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261006230818; original ledger name: admin_pre_order_15_day_trash.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

ALTER TABLE public.pre_orders
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_until timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

CREATE INDEX IF NOT EXISTS idx_pre_orders_admin_trash
  ON public.pre_orders(deleted_until DESC)
  WHERE deleted_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_remove_pre_order(
  p_order_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS TABLE(id uuid, deleted_at timestamptz, deleted_until timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_order public.pre_orders%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT (public.has_admin_permission(v_actor,'manage_orders'::public.admin_permission) OR public.is_support_agent(v_actor)) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_order FROM public.pre_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pre-order not found' USING ERRCODE='P0002'; END IF;
  IF v_order.deleted_at IS NOT NULL THEN
    RETURN QUERY SELECT v_order.id,v_order.deleted_at,v_order.deleted_until;
    RETURN;
  END IF;

  IF v_order.status IN ('accepted','completed','concluida') OR v_order.payment_status IN ('paid','pending','partially_refunded') THEN
    RAISE EXCEPTION 'PAID_OR_ACTIVE_ORDER_CANNOT_BE_REMOVED' USING ERRCODE='22023';
  END IF;

  IF v_order.stock_reserved THEN
    UPDATE public.products
    SET quantity=quantity+v_order.quantity,
        reserved_quantity=GREATEST(COALESCE(reserved_quantity,0)-v_order.quantity,0),
        status=CASE WHEN status='removed' AND quantity+v_order.quantity>0 THEN 'active' ELSE status END,
        updated_at=now()
    WHERE id=v_order.product_id;
  END IF;

  UPDATE public.pre_orders
  SET deleted_at=now(),
      deleted_until=now()+interval '15 days',
      deleted_by=v_actor,
      deletion_reason=COALESCE(NULLIF(btrim(p_reason),''),'Removido pelo administrador'),
      stock_reserved=false,
      updated_at=now()
  WHERE id=p_order_id
  RETURNING pre_orders.id,pre_orders.deleted_at,pre_orders.deleted_until
  INTO id,deleted_at,deleted_until;

  INSERT INTO public.audit_logs(event_type,action,user_id,details)
  VALUES('PRE_ORDER_MOVED_TO_TRASH','ADMIN_PRE_ORDER_REMOVED',v_actor,
    jsonb_build_object('pre_order_id',p_order_id,'deleted_until',deleted_until,'reason',p_reason));

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_remove_pre_order(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_pre_order(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.purge_expired_pre_order_trash()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_count integer;
BEGIN
  DELETE FROM public.pre_orders p
  WHERE p.deleted_at IS NOT NULL
    AND p.deleted_until <= now()
    AND NOT EXISTS (SELECT 1 FROM public.payment_intents pi WHERE pi.pre_order_id=p.id);
  GET DIAGNOSTICS v_count=ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_pre_order_trash() FROM PUBLIC,anon,authenticated;
