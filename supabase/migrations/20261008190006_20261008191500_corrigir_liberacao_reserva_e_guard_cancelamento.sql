-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261008190006; original ledger name: 20261008191500_corrigir_liberacao_reserva_e_guard_cancelamento.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

CREATE OR REPLACE FUNCTION public.guard_pre_order_cancellation_during_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_product public.products%ROWTYPE;
BEGIN
  IF NEW.product_id IS DISTINCT FROM OLD.product_id
    OR NEW.quantity IS DISTINCT FROM OLD.quantity THEN
    RAISE EXCEPTION 'A pre-order product and quantity cannot be changed after submission'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.stock_reserved IS DISTINCT FROM OLD.stock_reserved
    AND NOT (
      (OLD.status IS DISTINCT FROM 'accepted' AND NEW.status = 'accepted' AND NEW.stock_reserved = true)
      OR (NEW.status IN ('cancelled','rejected','expired') AND OLD.stock_reserved = true AND NEW.stock_reserved = false)
    ) THEN
    RAISE EXCEPTION 'Stock reservation is managed by the order lifecycle'
      USING ERRCODE = '22023';
  END IF;

  IF OLD.status IN ('rejected', 'cancelled', 'completed', 'concluida', 'cancelado')
    AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Final pre-orders cannot be reopened'
      USING ERRCODE = '22023';
  END IF;

  IF OLD.status = 'accepted' AND NEW.status IN ('pending', 'aguardando') THEN
    RAISE EXCEPTION 'An accepted pre-order cannot return to a pending state'
      USING ERRCODE = '22023';
  END IF;

  IF OLD.status IS DISTINCT FROM 'accepted' AND NEW.status = 'accepted'
    AND NOT OLD.stock_reserved THEN
    SELECT * INTO v_product
    FROM public.products
    WHERE id = NEW.product_id
    FOR UPDATE;

    IF NOT FOUND OR v_product.status <> 'active' THEN
      RAISE EXCEPTION 'Product is no longer available'
        USING ERRCODE = '22023';
    END IF;

    IF NEW.quantity > v_product.quantity THEN
      RAISE EXCEPTION 'Requested quantity exceeds remaining product stock'
        USING ERRCODE = '22023';
    END IF;

    UPDATE public.products
    SET quantity = quantity - NEW.quantity,
        reserved_quantity = coalesce(reserved_quantity,0) + NEW.quantity,
        updated_at = now()
    WHERE id = NEW.product_id;

    NEW.stock_reserved := TRUE;
  END IF;

  IF OLD.status = 'accepted' AND NEW.status IN ('cancelled', 'rejected')
    AND EXISTS (
      SELECT 1
      FROM public.freight_loads
      WHERE pre_order_id = OLD.id
        AND status IN ('in_transit', 'delivered')
    ) THEN
    RAISE EXCEPTION 'An order cannot be cancelled after GPS transport has started'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.status IN ('cancelled', 'rejected', 'expired')
    AND OLD.stock_reserved THEN
    NEW.stock_reserved := FALSE;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_marketplace_reservation(
  p_order_id uuid,
  p_expired boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.pre_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order
  FROM public.pre_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_order.stock_reserved THEN
    RETURN;
  END IF;

  UPDATE public.products
  SET quantity = quantity + v_order.quantity,
      reserved_quantity = greatest(coalesce(reserved_quantity,0) - v_order.quantity,0),
      status = CASE
        WHEN status = 'removed' AND quantity + v_order.quantity > 0 THEN 'active'
        ELSE status
      END,
      updated_at = now()
  WHERE id = v_order.product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_RESERVATION_RELEASE_FAILED';
  END IF;

  UPDATE public.pre_orders
  SET stock_reserved = false,
      reservation_expires_at = NULL,
      status = CASE WHEN p_expired THEN 'expired' ELSE status END,
      updated_at = now()
  WHERE id = p_order_id
    AND stock_reserved = true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.expire_marketplace_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT id
    FROM public.pre_orders
    WHERE status = 'pending'
      AND stock_reserved = true
      AND reservation_expires_at IS NOT NULL
      AND reservation_expires_at <= now()
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.release_marketplace_reservation(r.id, true);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$function$;
