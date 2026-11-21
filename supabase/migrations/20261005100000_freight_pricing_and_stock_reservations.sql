-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261005100000; original ledger name: freight_pricing_and_stock_reservations.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

BEGIN;

ALTER TABLE public.pre_orders
  ADD COLUMN stock_reserved BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.pre_orders
SET stock_reserved = TRUE
WHERE status = 'accepted';

ALTER TABLE public.freight_loads
  ADD COLUMN driver_offered_price NUMERIC,
  ADD COLUMN driver_price_method TEXT,
  ADD COLUMN driver_quote_status TEXT NOT NULL DEFAULT 'not_offered',
  ADD COLUMN route_distance_km NUMERIC,
  ADD COLUMN route_duration_minutes INTEGER,
  ADD CONSTRAINT freight_loads_driver_offered_price_check
    CHECK (driver_offered_price IS NULL OR driver_offered_price BETWEEN 0.01 AND 1000000000000),
  ADD CONSTRAINT freight_loads_driver_price_method_check
    CHECK (driver_price_method IS NULL OR driver_price_method IN ('manual', 'suggested')),
  ADD CONSTRAINT freight_loads_driver_quote_status_check
    CHECK (driver_quote_status IN ('not_offered', 'pending_buyer_approval', 'approved', 'rejected')),
  ADD CONSTRAINT freight_loads_route_distance_check
    CHECK (route_distance_km IS NULL OR route_distance_km > 0),
  ADD CONSTRAINT freight_loads_route_duration_check
    CHECK (route_duration_minutes IS NULL OR route_duration_minutes > 0);

CREATE TABLE public.freight_pricing_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  rate_per_km_per_100kg NUMERIC CHECK (
    rate_per_km_per_100kg IS NULL
    OR rate_per_km_per_100kg BETWEEN 1 AND 10000000
  ),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id)
);

INSERT INTO public.freight_pricing_settings (id, rate_per_km_per_100kg)
VALUES (TRUE, NULL);

ALTER TABLE public.freight_pricing_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.freight_pricing_settings FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.freight_pricing_settings TO authenticated;

REVOKE UPDATE ON public.freight_loads FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_freight_pricing_settings()
RETURNS TABLE (
  rate_per_km_per_100kg NUMERIC,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT settings.rate_per_km_per_100kg, settings.updated_at
  FROM public.freight_pricing_settings AS settings
  WHERE settings.id = TRUE;
$function$;

CREATE OR REPLACE FUNCTION public.set_freight_pricing_rate(p_rate NUMERIC)
RETURNS TABLE (
  rate_per_km_per_100kg NUMERIC,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id UUID := auth.uid();
BEGIN
  IF v_actor_id IS NULL
    OR NOT public.has_role(v_actor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only an administrator can change the freight pricing rate'
      USING ERRCODE = '42501';
  END IF;

  IF p_rate IS NULL OR p_rate < 1 OR p_rate > 10000000 THEN
    RAISE EXCEPTION 'The rate must be between 1 and 10,000,000 Kz'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  UPDATE public.freight_pricing_settings AS settings
  SET rate_per_km_per_100kg = p_rate,
      updated_at = NOW(),
      updated_by = v_actor_id
  WHERE settings.id = TRUE
  RETURNING settings.rate_per_km_per_100kg, settings.updated_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_freight_pricing_settings() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_freight_pricing_settings() TO authenticated;

REVOKE ALL ON FUNCTION public.set_freight_pricing_rate(NUMERIC) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.set_freight_pricing_rate(NUMERIC) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_pre_order_delivery_coordinates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_product public.products%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Authentication required to create a pre-order'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS NULL OR NEW.status NOT IN ('pending', 'aguardando') THEN
    RAISE EXCEPTION 'New pre-orders must start in a pending state'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.location IS NULL OR LENGTH(BTRIM(NEW.location)) < 3 THEN
    RAISE EXCEPTION 'A delivery point is required'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.destination_lat IS NULL OR NEW.destination_lng IS NULL
    OR NEW.destination_lat NOT BETWEEN -90 AND 90
    OR NEW.destination_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'A valid delivery point is required for GPS tracking'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.quantity IS NULL OR NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'The requested quantity must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_product
  FROM public.products
  WHERE id = NEW.product_id
  FOR UPDATE;

  IF NOT FOUND OR v_product.status <> 'active' THEN
    RAISE EXCEPTION 'Product is not available for pre-order'
      USING ERRCODE = '22023';
  END IF;

  IF v_product.user_id = NEW.user_id THEN
    RAISE EXCEPTION 'A producer cannot order their own product'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.quantity > v_product.quantity THEN
    RAISE EXCEPTION 'Requested quantity exceeds available product stock'
      USING ERRCODE = '22023';
  END IF;

  IF v_product.location_lat IS NULL OR v_product.location_lng IS NULL
    OR v_product.location_lat NOT BETWEEN -90 AND 90
    OR v_product.location_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Product has no valid GPS origin point'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.products
  SET quantity = quantity - NEW.quantity
  WHERE id = NEW.product_id;

  NEW.stock_reserved := TRUE;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prepare_pre_order_for_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF OLD.status IN ('accepted', 'completed', 'concluida')
    OR EXISTS (
    SELECT 1
    FROM public.freight_loads
    WHERE pre_order_id = OLD.id
      AND status IN ('accepted', 'in_transit', 'delivered')
  ) THEN
    RAISE EXCEPTION 'An accepted or completed order with an active GPS delivery cannot be deleted'
      USING ERRCODE = '22023';
  END IF;

  IF OLD.stock_reserved THEN
    UPDATE public.products
    SET quantity = quantity + OLD.quantity
    WHERE id = OLD.product_id;
  END IF;

  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_pre_order_cancellation_during_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_product public.products%ROWTYPE;
BEGIN
  IF NEW.product_id IS DISTINCT FROM OLD.product_id
    OR NEW.quantity IS DISTINCT FROM OLD.quantity THEN
    RAISE EXCEPTION 'A pre-order product and quantity cannot be changed after submission'
      USING ERRCODE = '22023';
  END IF;

  NEW.stock_reserved := OLD.stock_reserved;

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
    SELECT *
    INTO v_product
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
    SET quantity = quantity - NEW.quantity
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

  IF NEW.status IN ('cancelled', 'rejected') AND OLD.stock_reserved THEN
    UPDATE public.products
    SET quantity = quantity + OLD.quantity
    WHERE id = OLD.product_id;
    NEW.stock_reserved := FALSE;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_pre_order_cancellation_during_delivery ON public.pre_orders;

CREATE TRIGGER guard_pre_order_cancellation_during_delivery
BEFORE UPDATE OF status, stock_reserved, product_id, quantity ON public.pre_orders
FOR EACH ROW
EXECUTE FUNCTION public.guard_pre_order_cancellation_during_delivery();

CREATE OR REPLACE FUNCTION public.submit_freight_quote(
  p_freight_load_id UUID,
  p_price_method TEXT,
  p_manual_price NUMERIC,
  p_route_distance_km NUMERIC,
  p_route_duration_minutes INTEGER
)
RETURNS TABLE (
  id UUID,
  status TEXT,
  driver_id UUID,
  driver_offered_price NUMERIC,
  driver_price_method TEXT,
  driver_quote_status TEXT,
  route_distance_km NUMERIC,
  route_duration_minutes INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id UUID := auth.uid();
  v_user_type TEXT;
  v_capacity NUMERIC;
  v_email_verified BOOLEAN;
  v_rate NUMERIC;
  v_price NUMERIC;
  v_minimum_distance_km DOUBLE PRECISION;
  v_latitude_delta DOUBLE PRECISION;
  v_longitude_delta DOUBLE PRECISION;
  v_haversine DOUBLE PRECISION;
  v_load public.freight_loads%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT user_type::TEXT, load_capacity_kg, email_verified
  INTO v_user_type, v_capacity, v_email_verified
  FROM public.users
  WHERE id = v_actor_id;

  IF v_user_type IS DISTINCT FROM 'motorista'
    OR v_email_verified IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Only a verified driver can submit a delivery price'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_load
  FROM public.freight_loads
  WHERE id = p_freight_load_id
  FOR UPDATE;

  IF NOT FOUND OR v_load.pre_order_id IS NULL THEN
    RAISE EXCEPTION 'GPS order load not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_load.status NOT IN ('available', 'open', 'agendado')
    OR v_load.driver_id IS NOT NULL
    OR v_load.created_by = v_actor_id THEN
    RAISE EXCEPTION 'This freight load is no longer available'
      USING ERRCODE = '40001';
  END IF;

  IF v_capacity IS NOT NULL AND v_load.weight_kg > v_capacity THEN
    RAISE EXCEPTION 'Freight load exceeds the driver capacity'
      USING ERRCODE = '22023';
  END IF;

  IF p_route_distance_km IS NULL
    OR p_route_distance_km <= 0
    OR p_route_distance_km > 100000
    OR p_route_duration_minutes IS NULL
    OR p_route_duration_minutes <= 0 THEN
    RAISE EXCEPTION 'A valid road route must be calculated before submitting a price'
      USING ERRCODE = '22023';
  END IF;

  IF v_load.origin_lat IS NULL OR v_load.origin_lng IS NULL
    OR v_load.destination_lat IS NULL OR v_load.destination_lng IS NULL THEN
    RAISE EXCEPTION 'The GPS order must have valid route coordinates'
      USING ERRCODE = '22023';
  END IF;

  v_latitude_delta := radians(v_load.destination_lat - v_load.origin_lat);
  v_longitude_delta := radians(v_load.destination_lng - v_load.origin_lng);
  v_haversine :=
    power(sin(v_latitude_delta / 2), 2)
    + cos(radians(v_load.origin_lat)) * cos(radians(v_load.destination_lat))
    * power(sin(v_longitude_delta / 2), 2);
  v_minimum_distance_km := 2 * 6371 * asin(least(1, sqrt(v_haversine)));

  IF p_route_distance_km < v_minimum_distance_km * 0.95
    OR p_route_distance_km > greatest(v_minimum_distance_km * 10, v_minimum_distance_km + 50) THEN
    RAISE EXCEPTION 'Calculated road distance is inconsistent with the GPS points'
      USING ERRCODE = '22023';
  END IF;

  IF p_price_method = 'manual' THEN
    IF p_manual_price IS NULL
      OR p_manual_price < 0.01
      OR p_manual_price > 1000000000000
      OR p_manual_price::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'Enter a valid manual delivery price'
        USING ERRCODE = '22023';
    END IF;
    v_price := ROUND(p_manual_price, 2);
  ELSIF p_price_method = 'suggested' THEN
    SELECT settings.rate_per_km_per_100kg
    INTO v_rate
    FROM public.freight_pricing_settings AS settings
    WHERE settings.id = TRUE;

    IF v_rate IS NULL THEN
      RAISE EXCEPTION 'Automatic freight pricing has not been configured by AgriLink yet'
        USING ERRCODE = '22023';
    END IF;

    v_price := ROUND(p_route_distance_km * (v_load.weight_kg / 100) * v_rate, 2);
    IF v_price <= 0 THEN
      RAISE EXCEPTION 'The suggested delivery price is invalid'
        USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'Choose manual or suggested freight pricing'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.freight_loads
  SET driver_id = v_actor_id,
      status = 'accepted',
      accepted_at = NOW(),
      driver_offered_price = v_price,
      driver_price_method = p_price_method,
      driver_quote_status = 'pending_buyer_approval',
      route_distance_km = p_route_distance_km,
      route_duration_minutes = p_route_duration_minutes,
      updated_at = NOW()
  WHERE public.freight_loads.id = p_freight_load_id
  RETURNING * INTO v_load;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  SELECT
    pre_order.user_id,
    'pre_order',
    'Preço de transporte para aprovação',
    format(
      'O motorista propôs %s Kz para transportar %s kg. Aprove o preço no seu perfil antes do início da viagem.',
      to_char(v_load.driver_offered_price, 'FM999G999G999G990D00'),
      v_load.weight_kg
    ),
    jsonb_build_object('pre_order_id', pre_order.id, 'freight_load_id', v_load.id)
  FROM public.pre_orders AS pre_order
  WHERE pre_order.id = v_load.pre_order_id;

  RETURN QUERY
  SELECT v_load.id, v_load.status, v_load.driver_id, v_load.driver_offered_price,
    v_load.driver_price_method, v_load.driver_quote_status, v_load.route_distance_km,
    v_load.route_duration_minutes;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_freight_load(p_freight_load_id UUID)
RETURNS TABLE (
  id UUID,
  status TEXT,
  driver_id UUID,
  accepted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id UUID := auth.uid();
  v_user_type TEXT;
  v_capacity NUMERIC;
  v_email_verified BOOLEAN;
  v_load public.freight_loads%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT user_type::TEXT, load_capacity_kg, email_verified
  INTO v_user_type, v_capacity, v_email_verified
  FROM public.users
  WHERE id = v_actor_id;

  IF v_user_type IS DISTINCT FROM 'motorista'
    AND NOT public.has_role(v_actor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only an eligible driver can accept a freight load'
      USING ERRCODE = '42501';
  END IF;
  IF v_email_verified IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'A verified email is required to accept a freight load'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_load
  FROM public.freight_loads
  WHERE id = p_freight_load_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Freight load not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_load.pre_order_id IS NOT NULL THEN
    RAISE EXCEPTION 'Submit a delivery price proposal for this GPS order'
      USING ERRCODE = '22023';
  END IF;

  IF v_capacity IS NOT NULL AND v_load.weight_kg > v_capacity THEN
    RAISE EXCEPTION 'Freight load exceeds the driver capacity'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.freight_loads
  SET driver_id = v_actor_id,
      status = 'accepted',
      accepted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_freight_load_id
    AND driver_id IS NULL
    AND created_by <> v_actor_id
    AND status IN ('available', 'open', 'agendado')
  RETURNING * INTO v_load;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This freight load is no longer available'
      USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.audit_logs (event_type, action, user_id, details)
  VALUES (
    'FREIGHT_LOAD_STATUS_CHANGED',
    'DRIVER_ACCEPTED_FREIGHT_LOAD',
    v_actor_id,
    jsonb_build_object('freight_load_id', v_load.id, 'new_status', v_load.status)
  );

  RETURN QUERY SELECT v_load.id, v_load.status::TEXT, v_load.driver_id, v_load.accepted_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.respond_to_freight_quote(
  p_freight_load_id UUID,
  p_approved BOOLEAN
)
RETURNS TABLE (
  id UUID,
  status TEXT,
  driver_quote_status TEXT,
  driver_offered_price NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id UUID := auth.uid();
  v_load public.freight_loads%ROWTYPE;
  v_order public.pre_orders%ROWTYPE;
  v_driver_id UUID;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_load
  FROM public.freight_loads
  WHERE id = p_freight_load_id
  FOR UPDATE;

  IF NOT FOUND OR v_load.pre_order_id IS NULL THEN
    RAISE EXCEPTION 'Freight quote not found'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT *
  INTO v_order
  FROM public.pre_orders
  WHERE id = v_load.pre_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.user_id <> v_actor_id THEN
    RAISE EXCEPTION 'Only the buyer can respond to this freight quote'
      USING ERRCODE = '42501';
  END IF;

  IF v_load.driver_quote_status <> 'pending_buyer_approval'
    OR v_load.status <> 'accepted'
    OR v_load.driver_id IS NULL THEN
    RAISE EXCEPTION 'This freight quote is no longer awaiting approval'
      USING ERRCODE = '22023';
  END IF;

  IF p_approved IS NULL THEN
    RAISE EXCEPTION 'Choose whether to approve or reject the freight quote'
      USING ERRCODE = '22023';
  END IF;

  v_driver_id := v_load.driver_id;

  IF p_approved THEN
    UPDATE public.freight_loads
    SET driver_quote_status = 'approved',
        updated_at = NOW()
    WHERE id = p_freight_load_id
    RETURNING * INTO v_load;
  ELSE
    UPDATE public.freight_loads
    SET status = 'available',
        driver_id = NULL,
        accepted_at = NULL,
        driver_offered_price = NULL,
        driver_price_method = NULL,
        driver_quote_status = 'rejected',
        updated_at = NOW()
    WHERE id = p_freight_load_id
    RETURNING * INTO v_load;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    v_driver_id,
    'freight',
    CASE WHEN p_approved THEN 'Preço de transporte aprovado' ELSE 'Proposta de transporte recusada' END,
    CASE
      WHEN p_approved THEN 'O comprador aprovou o preço. Já pode iniciar o transporte.'
      ELSE 'O comprador recusou o preço. A carga voltou a ficar disponível para outros motoristas.'
    END,
    jsonb_build_object('freight_load_id', v_load.id, 'pre_order_id', v_order.id)
  );

  RETURN QUERY
  SELECT v_load.id, v_load.status, v_load.driver_quote_status, v_load.driver_offered_price;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_freight_quote(UUID, TEXT, NUMERIC, NUMERIC, INTEGER) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.submit_freight_quote(UUID, TEXT, NUMERIC, NUMERIC, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.respond_to_freight_quote(UUID, BOOLEAN) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.respond_to_freight_quote(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.advance_freight_load_status(
  p_freight_load_id UUID,
  p_status TEXT
)
RETURNS TABLE (
  id UUID,
  status TEXT,
  driver_id UUID,
  in_transit_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id UUID := auth.uid();
  v_user_type TEXT;
  v_email_verified BOOLEAN;
  v_load public.freight_loads%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('in_transit', 'delivered') THEN
    RAISE EXCEPTION 'Invalid freight load status'
      USING ERRCODE = '22023';
  END IF;

  SELECT user_type::TEXT, email_verified
  INTO v_user_type, v_email_verified
  FROM public.users
  WHERE id = v_actor_id;

  IF v_user_type IS DISTINCT FROM 'motorista'
    AND NOT public.has_role(v_actor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only an eligible driver can update a freight load'
      USING ERRCODE = '42501';
  END IF;
  IF v_email_verified IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'A verified email is required to update a freight load'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_load
  FROM public.freight_loads
  WHERE id = p_freight_load_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Freight load not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_load.driver_id IS DISTINCT FROM v_actor_id
    AND NOT public.has_role(v_actor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only the assigned driver can update this freight load'
      USING ERRCODE = '42501';
  END IF;

  IF p_status = 'in_transit'
    AND v_load.pre_order_id IS NOT NULL
    AND v_load.driver_quote_status <> 'approved' THEN
    RAISE EXCEPTION 'The buyer must approve the driver delivery price before transport starts'
      USING ERRCODE = '42501';
  END IF;

  IF NOT (
    (v_load.status = 'accepted' AND p_status = 'in_transit')
    OR (v_load.status = 'in_transit' AND p_status = 'delivered')
  ) THEN
    RAISE EXCEPTION 'Invalid freight load status transition'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.freight_loads
  SET status = p_status,
      in_transit_at = CASE WHEN p_status = 'in_transit' THEN NOW() ELSE in_transit_at END,
      delivered_at = CASE WHEN p_status = 'delivered' THEN NOW() ELSE delivered_at END,
      updated_at = NOW()
  WHERE id = p_freight_load_id
    AND driver_id = v_actor_id
    AND status = v_load.status
  RETURNING * INTO v_load;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Freight load status changed concurrently'
      USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.audit_logs (event_type, action, user_id, details)
  VALUES (
    'FREIGHT_LOAD_STATUS_CHANGED',
    'DRIVER_ADVANCED_FREIGHT_LOAD',
    v_actor_id,
    jsonb_build_object(
      'freight_load_id', v_load.id,
      'previous_status', CASE WHEN p_status = 'in_transit' THEN 'accepted' ELSE 'in_transit' END,
      'new_status', v_load.status
    )
  );

  RETURN QUERY
  SELECT v_load.id, v_load.status::TEXT, v_load.driver_id,
    v_load.in_transit_at, v_load.delivered_at;
END;
$function$;

COMMIT;
