-- Smart marketplace reservations: atomic stock checks, idempotency, expiry and stock consumption.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reserved_quantity numeric NOT NULL DEFAULT 0;
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
RETURNS TABLE(id uuid,product_id uuid,quantity numeric,unit_price numeric,total_price numeric,status text,reservation_expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_product public.products%ROWTYPE;
  v_order public.pre_orders%ROWTYPE;
  v_reservation_expires timestamptz := now() + interval '15 minutes';
  v_total numeric;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
  IF p_location IS NULL OR btrim(p_location) = '' THEN RAISE EXCEPTION 'DELIVERY_LOCATION_REQUIRED'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_order FROM public.pre_orders
    WHERE idempotency_key=p_idempotency_key AND user_id=v_user_id LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT v_order.id,v_order.product_id,v_order.quantity,
        coalesce(v_order.unit_price,v_order.total_price/nullif(v_order.quantity,0)),
        v_order.total_price,v_order.status,v_order.reservation_expires_at;
      RETURN;
    END IF;
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id=p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND'; END IF;
  IF v_product.status <> 'active' THEN RAISE EXCEPTION 'PRODUCT_NOT_AVAILABLE'; END IF;
  IF v_product.user_id = v_user_id THEN RAISE EXCEPTION 'SELLER_CANNOT_BUY_OWN_PRODUCT'; END IF;

  IF p_quantity > (v_product.quantity-coalesce(v_product.reserved_quantity,0)) THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK';
  END IF;

  v_total := p_quantity*v_product.price;

  INSERT INTO public.pre_orders(
    product_id,user_id,quantity,location,total_price,status,payment_status,
    delivery_lat,delivery_lng,stock_reserved,reservation_expires_at,unit_price,idempotency_key
  ) VALUES(
    p_product_id,v_user_id,p_quantity,btrim(p_location),v_total,'pending','unpaid',
    p_delivery_lat,p_delivery_lng,true,v_reservation_expires,v_product.price,p_idempotency_key
  ) RETURNING * INTO v_order;

  UPDATE public.products
  SET reserved_quantity=coalesce(reserved_quantity,0)+p_quantity,updated_at=now()
  WHERE id=p_product_id;

  RETURN QUERY SELECT v_order.id,v_order.product_id,v_order.quantity,v_order.unit_price,
    v_order.total_price,v_order.status,v_order.reservation_expires_at;
EXCEPTION WHEN unique_violation THEN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_order FROM public.pre_orders
    WHERE idempotency_key=p_idempotency_key AND user_id=v_user_id LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT v_order.id,v_order.product_id,v_order.quantity,
        coalesce(v_order.unit_price,v_order.total_price/nullif(v_order.quantity,0)),
        v_order.total_price,v_order.status,v_order.reservation_expires_at;
      RETURN;
    END IF;
  END IF;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_marketplace_pre_order(uuid,numeric,text,double precision,double precision,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_marketplace_pre_order(uuid,numeric,text,double precision,double precision,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.release_marketplace_reservation(p_order_id uuid,p_expired boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order public.pre_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.pre_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT v_order.stock_reserved THEN RETURN; END IF;
  UPDATE public.products SET reserved_quantity=greatest(coalesce(reserved_quantity,0)-v_order.quantity,0),updated_at=now() WHERE id=v_order.product_id;
  UPDATE public.pre_orders SET stock_reserved=false,status=case when p_expired then 'expired' else status end,updated_at=now() WHERE id=p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_marketplace_reservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status IN ('accepted','completed') AND OLD.status NOT IN ('accepted','completed') AND NEW.stock_reserved THEN
    UPDATE public.products
    SET quantity=quantity-NEW.quantity,reserved_quantity=greatest(coalesce(reserved_quantity,0)-NEW.quantity,0),updated_at=now()
    WHERE id=NEW.product_id AND quantity>=NEW.quantity AND coalesce(reserved_quantity,0)>=NEW.quantity;
    IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_COMMIT_FAILED'; END IF;
    NEW.stock_reserved:=false;
    NEW.reservation_expires_at:=NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_marketplace_reservations()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; n integer:=0;
BEGIN
  FOR r IN SELECT id FROM public.pre_orders
    WHERE status='pending' AND stock_reserved=true AND reservation_expires_at IS NOT NULL AND reservation_expires_at<=now()
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.release_marketplace_reservation(r.id,true);
    n:=n+1;
  END LOOP;
  RETURN n;
END;
$$;

DROP TRIGGER IF EXISTS trg_consume_marketplace_reservation ON public.pre_orders;
CREATE TRIGGER trg_consume_marketplace_reservation
BEFORE UPDATE OF status ON public.pre_orders
FOR EACH ROW EXECUTE FUNCTION public.consume_marketplace_reservation();

REVOKE ALL ON FUNCTION public.release_marketplace_reservation(uuid,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.consume_marketplace_reservation() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.expire_marketplace_reservations() FROM PUBLIC,anon,authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.schedule('agrilink-expire-marketplace-reservations','*/1 * * * *','SELECT public.expire_marketplace_reservations()');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
