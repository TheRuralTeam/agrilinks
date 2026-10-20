-- Persiste a preferência logística sem alterar a RPC antiga, para manter clientes existentes compatíveis.
ALTER TABLE public.marketplace_cart_orders
  ADD COLUMN IF NOT EXISTS freight_preference text NOT NULL DEFAULT 'single_quote_requested';

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'marketplace_cart_orders_freight_preference_check'
      AND conrelid = 'public.marketplace_cart_orders'::regclass
  ) THEN
    ALTER TABLE public.marketplace_cart_orders
      ADD CONSTRAINT marketplace_cart_orders_freight_preference_check
      CHECK (freight_preference IN ('single_quote_requested', 'separate_deliveries'));
  END IF;
END;
$migration$;

CREATE OR REPLACE FUNCTION public.create_marketplace_cart_order(
  p_items jsonb,
  p_delivery_location text,
  p_requested_delivery_date date,
  p_delivery_lat double precision DEFAULT NULL,
  p_delivery_lng double precision DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL,
  p_freight_preference text DEFAULT 'single_quote_requested'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_cart public.marketplace_cart_orders%ROWTYPE;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_child record;
  v_items jsonb := '[]'::jsonb;
  v_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = v_user_id AND lower(COALESCE(u.user_type, '')) = 'comprador'
  ) THEN
    RAISE EXCEPTION 'BUYER_ROLE_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_freight_preference IS NULL OR p_freight_preference NOT IN ('single_quote_requested', 'separate_deliveries') THEN
    RAISE EXCEPTION 'INVALID_FREIGHT_PREFERENCE' USING ERRCODE = '22023';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'INVALID_CART_ITEMS' USING ERRCODE = '22023';
  END IF;
  IF p_requested_delivery_date IS NULL OR p_requested_delivery_date < (now() AT TIME ZONE 'Africa/Luanda')::date THEN
    RAISE EXCEPTION 'INVALID_DELIVERY_DATE' USING ERRCODE = '22023';
  END IF;
  IF p_delivery_location IS NULL OR length(btrim(p_delivery_location)) < 3 THEN
    RAISE EXCEPTION 'DELIVERY_LOCATION_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF (p_delivery_lat IS NULL) <> (p_delivery_lng IS NULL) THEN
    RAISE EXCEPTION 'DELIVERY_COORDINATES_PAIR_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_delivery_lat IS NOT NULL AND (p_delivery_lat NOT BETWEEN -90 AND 90 OR p_delivery_lng NOT BETWEEN -180 AND 180) THEN
    RAISE EXCEPTION 'DELIVERY_COORDINATES_INVALID' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) AS x(item)
    GROUP BY (x.item->>'product_id') HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_PRODUCT_IN_CART' USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_cart FROM public.marketplace_cart_orders
    WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key;
    IF FOUND THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', po.id, 'product_id', po.product_id, 'quantity', po.quantity,
        'unit_price', po.unit_price, 'total_price', po.total_price,
        'status', po.status, 'requested_delivery_date', po.requested_delivery_date
      ) ORDER BY po.created_at), '[]'::jsonb)
      INTO v_items FROM public.pre_orders po WHERE po.cart_order_id = v_cart.id;
      RETURN jsonb_build_object('cart_order_id', v_cart.id, 'status', v_cart.status, 'items', v_items, 'idempotent_replay', true);
    END IF;
  END IF;

  INSERT INTO public.marketplace_cart_orders(
    user_id, idempotency_key, requested_delivery_date, delivery_location, destination_lat, destination_lng, freight_preference
  ) VALUES (
    v_user_id, COALESCE(p_idempotency_key, gen_random_uuid()), p_requested_delivery_date,
    btrim(p_delivery_location), p_delivery_lat, p_delivery_lng, p_freight_preference
  ) RETURNING * INTO v_cart;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_product_id := (v_item->>'product_id')::uuid;
      v_quantity := (v_item->>'quantity')::numeric;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'INVALID_CART_ITEM' USING ERRCODE = '22023';
    END;

    SELECT * INTO v_child
    FROM public.create_marketplace_pre_order(
      v_product_id, v_quantity, btrim(p_delivery_location),
      p_delivery_lat, p_delivery_lng, gen_random_uuid()
    ) LIMIT 1;

    UPDATE public.pre_orders
      SET cart_order_id = v_cart.id, requested_delivery_date = p_requested_delivery_date
      WHERE id = v_child.id AND user_id = v_user_id;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id', v_child.id, 'product_id', v_child.product_id, 'quantity', v_child.quantity,
      'unit_price', v_child.unit_price, 'total_price', v_child.total_price,
      'status', v_child.status, 'requested_delivery_date', p_requested_delivery_date
    ));
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('cart_order_id', v_cart.id, 'status', v_cart.status, 'freight_preference', v_cart.freight_preference, 'items', v_items, 'idempotent_replay', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_marketplace_cart_order(jsonb,text,date,double precision,double precision,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_marketplace_cart_order(jsonb,text,date,double precision,double precision,uuid,text) TO authenticated;

COMMENT ON TABLE public.marketplace_cart_orders IS
  'Agrupa várias pré-compras e guarda a preferência logística. A preferência de frete único é um pedido de cotação, não um valor calculado; aceitação/pagamento continuam por linha/pre-compra.';
COMMENT ON COLUMN public.pre_orders.requested_delivery_date IS
  'Data solicitada pelo comprador; não é promessa de entrega até confirmação logística.';
