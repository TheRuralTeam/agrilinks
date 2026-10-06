BEGIN;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_quantity_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_quantity_check CHECK (quantity >= 0);

ALTER TABLE public.pre_orders
  ADD COLUMN IF NOT EXISTS stock_fully_requested boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pre_orders_stock_fully_requested
  ON public.pre_orders(stock_fully_requested)
  WHERE stock_fully_requested = true;

-- Location coordinates are optional at reservation time. If the map provider is
-- temporarily unavailable, the order can still be created and coordinates can
-- be resolved before logistics starts.
CREATE OR REPLACE FUNCTION public.validate_pre_order_delivery_coordinates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  v_product public.products%ROWTYPE;
  v_available numeric;
  v_seller_email text;
  v_seller_type text;
BEGIN
  IF auth.uid() IS NULL OR NEW.user_id <> auth.uid() THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NEW.status IS NULL OR NEW.status NOT IN ('pending','aguardando') THEN RAISE EXCEPTION 'INVALID_PRE_ORDER_STATUS' USING ERRCODE='22023'; END IF;
  IF NEW.location IS NULL OR length(btrim(NEW.location)) < 3 THEN RAISE EXCEPTION 'DELIVERY_LOCATION_REQUIRED' USING ERRCODE='22023'; END IF;
  IF (NEW.destination_lat IS NULL) <> (NEW.destination_lng IS NULL) THEN RAISE EXCEPTION 'DELIVERY_COORDINATES_PAIR_REQUIRED' USING ERRCODE='22023'; END IF;
  IF NEW.destination_lat IS NOT NULL AND (NEW.destination_lat NOT BETWEEN -90 AND 90 OR NEW.destination_lng NOT BETWEEN -180 AND 180) THEN RAISE EXCEPTION 'DELIVERY_COORDINATES_INVALID' USING ERRCODE='22023'; END IF;
  IF NEW.quantity IS NULL OR NEW.quantity <= 0 OR NEW.quantity <> trunc(NEW.quantity) THEN RAISE EXCEPTION 'INVALID_QUANTITY' USING ERRCODE='22023'; END IF;

  SELECT * INTO v_product FROM public.products WHERE id=NEW.product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF v_product.status <> 'active' THEN RAISE EXCEPTION 'PRODUCT_NOT_AVAILABLE' USING ERRCODE='22023'; END IF;
  IF v_product.user_id=NEW.user_id THEN RAISE EXCEPTION 'SELLER_CANNOT_BUY_OWN_PRODUCT' USING ERRCODE='42501'; END IF;
  IF v_product.location_lat IS NULL OR v_product.location_lng IS NULL THEN RAISE EXCEPTION 'PRODUCT_ORIGIN_COORDINATES_REQUIRED' USING ERRCODE='22023'; END IF;

  v_available := GREATEST(COALESCE(v_product.quantity,0),0);

  IF v_available <= 0 THEN
    UPDATE public.products SET status='removed',updated_at=now() WHERE id=v_product.id AND status='active';
    RAISE EXCEPTION 'STOCK_UNAVAILABLE:0' USING ERRCODE='22023';
  END IF;

  IF NEW.quantity > v_available THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK:%',v_available USING ERRCODE='22023';
  END IF;

  NEW.stock_reserved := true;
  NEW.stock_fully_requested := (v_available - NEW.quantity <= 0);

  UPDATE public.products
  SET quantity=quantity-NEW.quantity,
      reserved_quantity=COALESCE(reserved_quantity,0)+NEW.quantity,
      status=CASE WHEN quantity-NEW.quantity <= 0 THEN 'removed' ELSE status END,
      updated_at=now()
  WHERE id=NEW.product_id;

  IF NEW.stock_fully_requested THEN
    SELECT email,user_type::text INTO v_seller_email,v_seller_type FROM public.users WHERE id=v_product.user_id;
    INSERT INTO public.audit_logs(user_id,action,log_time,event_type,user_email,user_type,details)
    VALUES (
      v_product.user_id,'stock_fully_requested',now(),'product_stock_fully_requested',
      v_seller_email,v_seller_type,
      jsonb_build_object(
        'product_id',v_product.id,
        'product_type',v_product.product_type,
        'requested_quantity',NEW.quantity,
        'stock_before',v_available,
        'stock_after',0,
        'pre_order_id',NEW.id,
        'message','Produto em estoque solicitado totalmente'
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

COMMIT;
