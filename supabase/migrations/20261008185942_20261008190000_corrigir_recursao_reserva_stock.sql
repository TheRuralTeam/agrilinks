-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261008185942; original ledger name: 20261008190000_corrigir_recursao_reserva_stock.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

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

  -- Não altera o status aqui. Isso evita recursão com o trigger
  -- AFTER UPDATE OF status em pre_orders.
  UPDATE public.pre_orders
  SET stock_reserved = false,
      reservation_expires_at = NULL,
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

    UPDATE public.pre_orders
    SET status = 'expired',
        updated_at = now()
    WHERE id = r.id
      AND status = 'pending'
      AND stock_reserved = false;

    n := n + 1;
  END LOOP;

  RETURN n;
END;
$function$;
