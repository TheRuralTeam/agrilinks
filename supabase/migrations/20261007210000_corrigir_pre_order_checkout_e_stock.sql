BEGIN;

-- Consolida o contrato financeiro da pré-compra.
-- O total é persistido para o checkout e auditoria, mas continua a ser
-- calculado exclusivamente no servidor a partir de quantidade x preço unitário.
ALTER TABLE public.pre_orders
  ADD COLUMN IF NOT EXISTS total_price numeric;

UPDATE public.pre_orders po
SET total_price = po.quantity * COALESCE(
  po.unit_price,
  (SELECT p.price FROM public.products p WHERE p.id = po.product_id),
  0
)
WHERE po.total_price IS NULL;

ALTER TABLE public.pre_orders
  ALTER COLUMN total_price SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pre_orders_payment_status
  ON public.pre_orders(payment_status);

-- A reserva de stock é feita pelo trigger BEFORE INSERT
-- validate_pre_order_delivery_coordinates().
-- O RPC apenas valida o stock disponível e cria a pré-compra.
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
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity <> trunc(p_quantity) THEN
    RAISE EXCEPTION 'INVALID_QUANTITY' USING ERRCODE='22023';
  END IF;

  IF p_location IS NULL OR btrim(p_location) = '' THEN
    RAISE EXCEPTION 'DELIVERY_LOCATION_REQUIRED' USING ERRCODE='22023';
  END IF;

  IF p_delivery_lat IS NULL OR p_delivery_lng IS NULL
     OR p_delivery_lat NOT BETWEEN -90 AND 90
     OR p_delivery_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'DELIVERY_COORDINATES_REQUIRED' USING ERRCODE='22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT *
    INTO v_order
    FROM public.pre_orders
    WHERE idempotency_key = p_idempotency_key
      AND user_id = v_user_id
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY
      SELECT
        v_order.id,
        v_order.product_id,
        v_order.quantity,
        v_order.unit_price,
        v_order.total_price,
        v_order.status,
        v_order.reservation_expires_at;
      RETURN;
    END IF;
  END IF;

  SELECT *
  INTO v_product
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND' USING ERRCODE='P0002';
  END IF;

  IF v_product.status <> 'active' THEN
    RAISE EXCEPTION 'PRODUCT_NOT_AVAILABLE' USING ERRCODE='22023';
  END IF;

  IF v_product.user_id = v_user_id THEN
    RAISE EXCEPTION 'SELLER_CANNOT_BUY_OWN_PRODUCT' USING ERRCODE='42501';
  END IF;

  -- quantity representa o stock livre. O reserved_quantity representa
  -- exclusivamente a parte já comprometida por pré-compras activas.
  IF p_quantity > COALESCE(v_product.quantity, 0) THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', COALESCE(v_product.quantity, 0)
      USING ERRCODE='22023';
  END IF;

  IF v_product.location_lat IS NULL OR v_product.location_lng IS NULL THEN
    RAISE EXCEPTION 'PRODUCT_ORIGIN_COORDINATES_REQUIRED' USING ERRCODE='22023';
  END IF;

  v_total := p_quantity * v_product.price;

  INSERT INTO public.pre_orders(
    product_id,
    user_id,
    quantity,
    location,
    total_price,
    status,
    payment_status,
    destination_lat,
    destination_lng,
    stock_reserved,
    reservation_expires_at,
    unit_price,
    idempotency_key
  )
  VALUES(
    p_product_id,
    v_user_id,
    p_quantity::integer,
    btrim(p_location),
    v_total,
    'pending',
    'unpaid',
    p_delivery_lat,
    p_delivery_lng,
    false,
    v_reservation_expires,
    v_product.price,
    p_idempotency_key
  )
  RETURNING * INTO v_order;

  RETURN QUERY
  SELECT
    v_order.id,
    v_order.product_id,
    v_order.quantity,
    v_order.unit_price,
    v_order.total_price,
    v_order.status,
    v_order.reservation_expires_at;

EXCEPTION
  WHEN unique_violation THEN
    IF p_idempotency_key IS NOT NULL THEN
      SELECT *
      INTO v_order
      FROM public.pre_orders
      WHERE idempotency_key = p_idempotency_key
        AND user_id = v_user_id
      LIMIT 1;

      IF FOUND THEN
        RETURN QUERY
        SELECT
          v_order.id,
          v_order.product_id,
          v_order.quantity,
          v_order.unit_price,
          v_order.total_price,
          v_order.status,
          v_order.reservation_expires_at;
        RETURN;
      END IF;
    END IF;

    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_marketplace_pre_order(
  uuid,numeric,text,double precision,double precision,uuid
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_marketplace_pre_order(
  uuid,numeric,text,double precision,double precision,uuid
) TO authenticated;

-- A quantidade já foi retirada do stock livre no momento da reserva.
-- Ao aceitar, apenas deixamos de considerar a quantidade como reservada.
CREATE OR REPLACE FUNCTION public.consume_marketplace_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('accepted','completed')
     AND OLD.status NOT IN ('accepted','completed')
     AND NEW.stock_reserved THEN

    UPDATE public.products
    SET reserved_quantity = GREATEST(
      COALESCE(reserved_quantity, 0) - NEW.quantity,
      0
    ),
    updated_at = now()
    WHERE id = NEW.product_id
      AND COALESCE(reserved_quantity, 0) >= NEW.quantity;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'STOCK_COMMIT_FAILED' USING ERRCODE='22023';
    END IF;

    NEW.stock_reserved := false;
    NEW.reservation_expires_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_marketplace_reservation()
  FROM PUBLIC, anon, authenticated;

COMMIT;
