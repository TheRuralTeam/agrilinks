-- Fix ambiguity between RETURNS TABLE(id ...) and public.users.id.
CREATE OR REPLACE FUNCTION public.submit_freight_quote(
  p_freight_load_id uuid,
  p_price_method text,
  p_manual_price numeric,
  p_route_distance_km numeric,
  p_route_duration_minutes integer
)
RETURNS TABLE(
  id uuid, status text, driver_id uuid, driver_offered_price numeric,
  driver_price_method text, driver_quote_status text,
  route_distance_km numeric, route_duration_minutes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor_id UUID := auth.uid();
  v_user_type TEXT;
  v_capacity NUMERIC;
  v_email_verified BOOLEAN;
  v_base_fare NUMERIC;
  v_rate_per_km NUMERIC;
  v_rate_per_100kg NUMERIC;
  v_category_multipliers JSONB;
  v_product_category TEXT;
  v_category_multiplier NUMERIC;
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

  SELECT u.user_type::TEXT, u.load_capacity_kg, u.email_verified
  INTO v_user_type, v_capacity, v_email_verified
  FROM public.users AS u
  WHERE u.id = v_actor_id;

  IF v_user_type IS DISTINCT FROM 'motorista'
    OR v_email_verified IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Only a verified driver can submit a delivery price'
      USING ERRCODE = '42501';
  END IF;

  SELECT fl.* INTO v_load
  FROM public.freight_loads AS fl
  WHERE fl.id = p_freight_load_id
  FOR UPDATE;

  IF NOT FOUND OR v_load.pre_order_id IS NULL THEN
    RAISE EXCEPTION 'GPS order load not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_load.status NOT IN ('available', 'open', 'agendado')
    OR v_load.driver_id IS NOT NULL
    OR v_load.created_by = v_actor_id THEN
    RAISE EXCEPTION 'This freight load is no longer available' USING ERRCODE = '40001';
  END IF;

  IF v_capacity IS NOT NULL AND v_load.weight_kg > v_capacity THEN
    RAISE EXCEPTION 'Freight load exceeds the driver capacity' USING ERRCODE = '22023';
  END IF;

  IF p_route_distance_km IS NULL OR p_route_distance_km <= 0 OR p_route_distance_km > 100000
    OR p_route_duration_minutes IS NULL OR p_route_duration_minutes <= 0 THEN
    RAISE EXCEPTION 'A valid road route must be calculated before submitting a price' USING ERRCODE = '22023';
  END IF;

  IF v_load.origin_lat IS NULL OR v_load.origin_lng IS NULL
    OR v_load.destination_lat IS NULL OR v_load.destination_lng IS NULL THEN
    RAISE EXCEPTION 'The GPS order must have valid route coordinates' USING ERRCODE = '22023';
  END IF;

  v_latitude_delta := radians(v_load.destination_lat - v_load.origin_lat);
  v_longitude_delta := radians(v_load.destination_lng - v_load.origin_lng);
  v_haversine := power(sin(v_latitude_delta / 2), 2)
    + cos(radians(v_load.origin_lat)) * cos(radians(v_load.destination_lat))
    * power(sin(v_longitude_delta / 2), 2);
  v_minimum_distance_km := 2 * 6371 * asin(least(1, sqrt(v_haversine)));

  IF p_route_distance_km < v_minimum_distance_km * 0.95
    OR p_route_distance_km > greatest(v_minimum_distance_km * 10, v_minimum_distance_km + 50) THEN
    RAISE EXCEPTION 'Calculated road distance is inconsistent with the GPS points' USING ERRCODE = '22023';
  END IF;

  IF p_price_method = 'manual' THEN
    IF p_manual_price IS NULL OR p_manual_price < 0.01 OR p_manual_price > 1000000000000
      OR p_manual_price::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'Enter a valid manual delivery price' USING ERRCODE = '22023';
    END IF;
    v_price := ROUND(p_manual_price, 2);
  ELSIF p_price_method = 'suggested' THEN
    SELECT settings.base_fare_kz, settings.rate_per_km_kz,
      settings.rate_per_100kg_kz, settings.category_multipliers
    INTO v_base_fare, v_rate_per_km, v_rate_per_100kg, v_category_multipliers
    FROM public.freight_pricing_settings AS settings
    WHERE settings.id = TRUE;

    IF v_base_fare IS NULL OR v_rate_per_km IS NULL OR v_rate_per_100kg IS NULL THEN
      RAISE EXCEPTION 'AgriLink has not completed the automatic pricing configuration' USING ERRCODE = '22023';
    END IF;

    SELECT lower(BTRIM(product.category)) INTO v_product_category
    FROM public.products AS product WHERE product.id = v_load.product_id;

    v_category_multiplier := COALESCE(
      (v_category_multipliers ->> COALESCE(v_product_category, ''))::NUMERIC, 1
    );
    v_price := ROUND((
      v_base_fare + (p_route_distance_km * v_rate_per_km)
      + ((v_load.weight_kg / 100) * v_rate_per_100kg)
    ) * v_category_multiplier, 2);

    IF v_price <= 0 OR v_price > 1000000000000 THEN
      RAISE EXCEPTION 'The suggested delivery price is invalid' USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'Choose manual or suggested freight pricing' USING ERRCODE = '22023';
  END IF;

  UPDATE public.freight_loads AS fl
  SET driver_id = v_actor_id, status = 'accepted', accepted_at = NOW(),
      driver_offered_price = v_price, driver_price_method = p_price_method,
      driver_quote_status = 'pending_buyer_approval',
      route_distance_km = p_route_distance_km,
      route_duration_minutes = p_route_duration_minutes, updated_at = NOW()
  WHERE fl.id = p_freight_load_id
  RETURNING fl.* INTO v_load;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  SELECT pre_order.user_id, 'pre_order', 'Preço de transporte para aprovação',
    format(
      'O motorista propôs %s Kz para transportar %s kg. Aprove o preço no seu perfil antes do início da viagem.',
      to_char(v_load.driver_offered_price, 'FM999G999G999G990D00'), v_load.weight_kg
    ),
    jsonb_build_object('pre_order_id', pre_order.id, 'freight_load_id', v_load.id)
  FROM public.pre_orders AS pre_order
  WHERE pre_order.id = v_load.pre_order_id;

  RETURN QUERY SELECT v_load.id, v_load.status, v_load.driver_id,
    v_load.driver_offered_price, v_load.driver_price_method, v_load.driver_quote_status,
    v_load.route_distance_km, v_load.route_duration_minutes;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_freight_quote(uuid, text, numeric, numeric, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_freight_quote(uuid, text, numeric, numeric, integer) TO authenticated;
