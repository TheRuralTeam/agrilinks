-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261006100000; original ledger name: freight_taxi_style_pricing.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

BEGIN;

ALTER TABLE public.freight_pricing_settings
  ADD COLUMN base_fare_kz NUMERIC,
  ADD COLUMN rate_per_km_kz NUMERIC,
  ADD COLUMN rate_per_100kg_kz NUMERIC,
  ADD COLUMN category_multipliers JSONB NOT NULL DEFAULT jsonb_build_object(
    'frutas', 1,
    'citrus', 1,
    'legumes', 1,
    'verduras', 1,
    'cereais', 1,
    'tempero', 1,
    'pescado', 1,
    'carnes', 1,
    'ovos', 1,
    'paes', 1,
    'lacteos', 1,
    'bebidas', 1
  ),
  ADD CONSTRAINT freight_pricing_base_fare_check
    CHECK (base_fare_kz IS NULL OR base_fare_kz BETWEEN 0 AND 1000000000000),
  ADD CONSTRAINT freight_pricing_per_km_check
    CHECK (rate_per_km_kz IS NULL OR rate_per_km_kz BETWEEN 0.01 AND 1000000000),
  ADD CONSTRAINT freight_pricing_per_100kg_check
    CHECK (rate_per_100kg_kz IS NULL OR rate_per_100kg_kz BETWEEN 0 AND 1000000000000),
  ADD CONSTRAINT freight_pricing_category_multipliers_check
    CHECK (jsonb_typeof(category_multipliers) = 'object');

DROP FUNCTION public.get_freight_pricing_settings();

CREATE FUNCTION public.get_freight_pricing_settings()
RETURNS TABLE (
  rate_per_km_per_100kg NUMERIC,
  updated_at TIMESTAMPTZ,
  base_fare_kz NUMERIC,
  rate_per_km_kz NUMERIC,
  rate_per_100kg_kz NUMERIC,
  category_multipliers JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    settings.rate_per_km_per_100kg,
    settings.updated_at,
    settings.base_fare_kz,
    settings.rate_per_km_kz,
    settings.rate_per_100kg_kz,
    settings.category_multipliers
  FROM public.freight_pricing_settings AS settings
  WHERE settings.id = TRUE;
$function$;

REVOKE ALL ON FUNCTION public.get_freight_pricing_settings() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_freight_pricing_settings() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_freight_pricing_model(
  p_base_fare_kz NUMERIC,
  p_rate_per_km_kz NUMERIC,
  p_rate_per_100kg_kz NUMERIC,
  p_category_multipliers JSONB
)
RETURNS TABLE (
  base_fare_kz NUMERIC,
  rate_per_km_kz NUMERIC,
  rate_per_100kg_kz NUMERIC,
  category_multipliers JSONB,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id UUID := auth.uid();
  v_category_key TEXT;
  v_multiplier NUMERIC;
  v_allowed_categories TEXT[] := ARRAY[
    'frutas', 'citrus', 'legumes', 'verduras', 'cereais', 'tempero',
    'pescado', 'carnes', 'ovos', 'paes', 'lacteos', 'bebidas'
  ];
BEGIN
  IF v_actor_id IS NULL
    OR NOT public.has_role(v_actor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only an administrator can change the freight pricing model'
      USING ERRCODE = '42501';
  END IF;

  IF p_base_fare_kz IS NULL OR p_base_fare_kz < 0 OR p_base_fare_kz > 1000000000000
    OR p_rate_per_km_kz IS NULL OR p_rate_per_km_kz < 0.01 OR p_rate_per_km_kz > 1000000000
    OR p_rate_per_100kg_kz IS NULL OR p_rate_per_100kg_kz < 0
    OR p_rate_per_100kg_kz > 1000000000000
    OR p_base_fare_kz::TEXT IN ('NaN', 'Infinity', '-Infinity')
    OR p_rate_per_km_kz::TEXT IN ('NaN', 'Infinity', '-Infinity')
    OR p_rate_per_100kg_kz::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Enter valid non-negative base and weight rates and a positive per-kilometre rate'
      USING ERRCODE = '22023';
  END IF;

  IF p_category_multipliers IS NULL OR jsonb_typeof(p_category_multipliers) <> 'object' THEN
    RAISE EXCEPTION 'Category multipliers must be supplied as a JSON object'
      USING ERRCODE = '22023';
  END IF;

  FOR v_category_key IN SELECT jsonb_object_keys(p_category_multipliers)
  LOOP
    IF NOT (v_category_key = ANY(v_allowed_categories)) THEN
      RAISE EXCEPTION 'Unsupported freight category: %', v_category_key
        USING ERRCODE = '22023';
    END IF;

    IF jsonb_typeof(p_category_multipliers -> v_category_key) <> 'number' THEN
      RAISE EXCEPTION 'Category multiplier for % must be numeric', v_category_key
        USING ERRCODE = '22023';
    END IF;

    v_multiplier := (p_category_multipliers ->> v_category_key)::NUMERIC;
    IF v_multiplier < 0.25 OR v_multiplier > 5 THEN
      RAISE EXCEPTION 'Category multiplier for % must be between 0.25 and 5', v_category_key
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_allowed_categories) AS category_key
    WHERE NOT (p_category_multipliers ? category_key)
  ) THEN
    RAISE EXCEPTION 'A multiplier is required for every product category'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  UPDATE public.freight_pricing_settings AS settings
  SET base_fare_kz = p_base_fare_kz,
      rate_per_km_kz = p_rate_per_km_kz,
      rate_per_100kg_kz = p_rate_per_100kg_kz,
      category_multipliers = p_category_multipliers,
      updated_at = NOW(),
      updated_by = v_actor_id
  WHERE settings.id = TRUE
  RETURNING
    settings.base_fare_kz,
    settings.rate_per_km_kz,
    settings.rate_per_100kg_kz,
    settings.category_multipliers,
    settings.updated_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_freight_pricing_model(NUMERIC, NUMERIC, NUMERIC, JSONB) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.set_freight_pricing_model(NUMERIC, NUMERIC, NUMERIC, JSONB) TO authenticated;

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
    SELECT
      settings.base_fare_kz,
      settings.rate_per_km_kz,
      settings.rate_per_100kg_kz,
      settings.category_multipliers
    INTO v_base_fare, v_rate_per_km, v_rate_per_100kg, v_category_multipliers
    FROM public.freight_pricing_settings AS settings
    WHERE settings.id = TRUE;

    IF v_base_fare IS NULL OR v_rate_per_km IS NULL OR v_rate_per_100kg IS NULL THEN
      RAISE EXCEPTION 'AgriLink has not completed the automatic pricing configuration'
        USING ERRCODE = '22023';
    END IF;

    SELECT lower(BTRIM(product.category))
    INTO v_product_category
    FROM public.products AS product
    WHERE product.id = v_load.product_id;

    v_category_multiplier := COALESCE(
      (v_category_multipliers ->> COALESCE(v_product_category, ''))::NUMERIC,
      1
    );
    v_price := ROUND(
      (
        v_base_fare
        + (p_route_distance_km * v_rate_per_km)
        + ((v_load.weight_kg / 100) * v_rate_per_100kg)
      ) * v_category_multiplier,
      2
    );

    IF v_price <= 0 OR v_price > 1000000000000 THEN
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

COMMIT;
