-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261006221756; original ledger name: marketplace_transactional_pre_order.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS reserved_quantity numeric NOT NULL DEFAULT 0;

ALTER TABLE public.pre_orders
  ADD COLUMN IF NOT EXISTS reservation_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS unit_price numeric,
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS ux_pre_orders_idempotency_key
  ON public.pre_orders(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pre_orders_reservation_expiry
  ON public.pre_orders(reservation_expires_at)
  WHERE status = 'pending' AND stock_reserved = true;

CREATE OR REPLACE FUNCTION public.create_marketplace_pre_order(
  p_product_id uuid,
  p_quantity numeric,
  p_location text,
  p_delivery_lat double precision DEFAULT NULL,
  p_delivery_lng double precision DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  product_id uuid,
  quantity numeric,
  unit_price numeric,
  total_price numeric,
  status text,
  reservation_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_product public.products%ROWTYPE;
  v_order public.pre_orders%ROWTYPE;
  v_reservation_expires timestamptz := now() + interval '15 minutes';
  v_total numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY';
  END IF;

  IF p_location IS NULL OR btrim(p_location) = '' THEN
    RAISE EXCEPTION 'DELIVERY_LOCATION_REQUIRED';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_order
    FROM public.pre_orders
    WHERE idempotency_key = p_idempotency_key
      AND user_id = v_user_id
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT v_order.id, v_order.product_id, v_order.quantity,
        COALESCE(v_order.unit_price, v_order.total_price / NULLIF(v_order.quantity,0)),
        v_order.total_price, v_order.status, v_order.reservation_expires_at;
      RETURN;
    END IF;
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;
  IF v_product.status <> 'active' THEN RAISE EXCEPTION 'PRODUCT_NOT_AVAILABLE'; END IF;
  IF v_product.user_id = v_user_id THEN RAISE EXCEPTION 'SELLER_CANNOT_BUY_OWN_PRODUCT'; END IF;

  IF p_quantity > (v_product.quantity - COALESCE(v_product.reserved_quantity,0)) THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK';
  END IF;

  v_total := p_quantity * v_product.price;

  INSERT INTO public.pre_orders (
    product_id,user_id,quantity,location,total_price,status,
    payment_status,delivery_lat,delivery_lng,stock_reserved,
    reservation_expires_at,unit_price,idempotency_key
  ) VALUES (
    p_product_id,v_user_id,p_quantity,btrim(p_location),v_total,'pending',
    'unpaid',p_delivery_lat,p_delivery_lng,true,
    v_reservation_expires,v_product.price,p_idempotency_key
  )
  RETURNING * INTO v_order;

  UPDATE public.products
  SET reserved_quantity = COALESCE(reserved_quantity,0) + p_quantity,
      updated_at = now()
  WHERE id = p_product_id;

  RETURN QUERY SELECT v_order.id,v_order.product_id,v_order.quantity,
    v_order.unit_price,v_order.total_price,v_order.status,v_order.reservation_expires_at;
EXCEPTION
  WHEN unique_violation THEN
    IF p_idempotency_key IS NOT NULL THEN
      SELECT * INTO v_order FROM public.pre_orders
      WHERE idempotency_key = p_idempotency_key AND user_id = v_user_id LIMIT 1;
      IF FOUND THEN
        RETURN QUERY SELECT v_order.id,v_order.product_id,v_order.quantity,
          COALESCE(v_order.unit_price, v_order.total_price / NULLIF(v_order.quantity,0)),
          v_order.total_price,v_order.status,v_order.reservation_expires_at;
        RETURN;
      END IF;
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_marketplace_pre_order(uuid,numeric,text,double precision,double precision,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_marketplace_pre_order(uuid,numeric,text,double precision,double precision,uuid) TO authenticated;
