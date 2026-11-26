-- Remove the obsolete per-driver daily assignment restriction.
DROP TRIGGER IF EXISTS trg_enforce_one_driver_freight_load_per_day ON public.freight_loads;
DROP INDEX IF EXISTS public.freight_loads_one_driver_load_per_day_uidx;
DROP FUNCTION IF EXISTS public.enforce_one_driver_freight_load_per_day();

-- Require a current preventive-maintenance declaration for every vehicle used in freight.
ALTER TABLE public.driver_vehicles
  ADD COLUMN IF NOT EXISTS maintenance_valid_until date;

ALTER TABLE public.freight_loads
  ADD COLUMN IF NOT EXISTS driver_commitment_confirmed_at timestamptz;

-- Drivers may update their own vehicle data so they can keep maintenance and compliance dates current.
DROP POLICY IF EXISTS "Drivers can update own vehicles" ON public.driver_vehicles;
CREATE POLICY "Drivers can update own vehicles"
  ON public.driver_vehicles FOR UPDATE TO authenticated
  USING (driver_id = (SELECT auth.uid()))
  WITH CHECK (driver_id = (SELECT auth.uid()));
GRANT UPDATE ON public.driver_vehicles TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_driver_vehicle_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    IF coalesce(auth.role(), '') = 'service_role' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF public.is_agrilink_admin() THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS DISTINCT FROM OLD.driver_id
    OR NEW.id IS DISTINCT FROM OLD.id
    OR NEW.driver_id IS DISTINCT FROM OLD.driver_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.is_active IS DISTINCT FROM OLD.is_active
    OR NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    RAISE EXCEPTION 'Drivers cannot change vehicle ownership, activation or administrative review fields'
      USING ERRCODE = '42501';
  END IF;

  -- Any driver-edited vehicle data returns the record to the review queue.
  NEW.verification_status := 'pending_review';
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_driver_vehicle_admin_fields ON public.driver_vehicles;
CREATE TRIGGER trg_protect_driver_vehicle_admin_fields
  BEFORE UPDATE ON public.driver_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.protect_driver_vehicle_admin_fields();

REVOKE ALL ON FUNCTION public.protect_driver_vehicle_admin_fields() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_freight_quote(p_freight_load_id uuid, p_price_method text, p_manual_price numeric, p_route_distance_km numeric, p_route_duration_minutes integer, p_vehicle_id uuid, p_snapped_origin_lat double precision, p_snapped_origin_lng double precision, p_snapped_destination_lat double precision, p_snapped_destination_lng double precision, p_driver_commitment_confirmed boolean)
 RETURNS TABLE(id uuid, status text, driver_id uuid, driver_offered_price numeric, driver_price_method text, driver_quote_status text, route_distance_km numeric, route_duration_minutes integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_user_type text;
  v_email_verified boolean;
  v_vehicle public.driver_vehicles%ROWTYPE;
  v_license public.driver_licenses%ROWTYPE;
  v_base_fare numeric;
  v_rate_per_km numeric;
  v_rate_per_100kg numeric;
  v_category_multipliers jsonb;
  v_product_category text;
  v_category_multiplier numeric;
  v_price numeric;
  v_minimum_distance_km double precision;
  v_origin_snap_distance_km double precision;
  v_destination_snap_distance_km double precision;
  v_snap_haversine double precision;
  v_latitude_delta double precision;
  v_longitude_delta double precision;
  v_haversine double precision;
  v_load public.freight_loads%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_driver_commitment_confirmed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Confirm your availability and delivery commitments before submitting this freight quote'
      USING ERRCODE = '42501';
  END IF;

  SELECT u.user_type::text, u.email_verified
    INTO v_user_type, v_email_verified
  FROM public.users AS u
  WHERE u.id = v_actor_id;

  IF v_user_type IS DISTINCT FROM 'motorista' OR v_email_verified IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Only a verified driver can submit a delivery price' USING ERRCODE = '42501';
  END IF;

  SELECT dl.* INTO v_license
  FROM public.driver_licenses AS dl
  WHERE dl.driver_id = v_actor_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Complete your driving licence details in your personal profile before accepting freight'
      USING ERRCODE = '42501';
  END IF;
  IF v_license.verification_status = 'rejected'
    OR v_license.issued_at > current_date
    OR v_license.expires_at < current_date THEN
    RAISE EXCEPTION 'Your driving licence is rejected, not yet valid or expired'
      USING ERRCODE = '42501';
  END IF;

  SELECT dv.* INTO v_vehicle
  FROM public.driver_vehicles AS dv
  WHERE dv.id = p_vehicle_id
    AND dv.driver_id = v_actor_id
    AND dv.is_active = true
    AND dv.verification_status <> 'rejected'
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Register and select an active vehicle before proposing freight' USING ERRCODE = '42501';
  END IF;

  IF v_vehicle.capacity_kg < 1 THEN
    RAISE EXCEPTION 'The selected vehicle has no valid load capacity' USING ERRCODE = '22023';
  END IF;
  IF NOT v_vehicle.brakes_ok OR NOT v_vehicle.tires_ok OR NOT v_vehicle.lights_ok
    OR v_vehicle.body_condition = 'needs_attention' THEN
    RAISE EXCEPTION 'The selected vehicle does not meet minimum safety requirements' USING ERRCODE = '22023';
  END IF;

  IF v_vehicle.maintenance_valid_until IS NULL OR v_vehicle.maintenance_valid_until < current_date THEN
    RAISE EXCEPTION 'A manutenção preventiva do veículo está em falta ou fora da validade. Actualize o registo antes de aceitar cargas.' USING ERRCODE = '22023';
  END IF;
  IF v_vehicle.inspection_valid_until IS NULL OR v_vehicle.inspection_valid_until < current_date
    OR v_vehicle.insurance_valid_until IS NULL OR v_vehicle.insurance_valid_until < current_date THEN
    RAISE EXCEPTION 'A inspecção e o seguro do veículo devem estar válidos antes de aceitar cargas.' USING ERRCODE = '22023';
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

  IF v_load.weight_kg > v_vehicle.capacity_kg THEN
    RAISE EXCEPTION 'Freight load exceeds the selected vehicle capacity' USING ERRCODE = '22023';
  END IF;

  IF p_route_distance_km IS NULL OR p_route_distance_km <= 0 OR p_route_distance_km > 100000
    OR p_route_duration_minutes IS NULL OR p_route_duration_minutes <= 0 THEN
    RAISE EXCEPTION 'A valid road route must be calculated before submitting a price' USING ERRCODE = '22023';
  END IF;

  IF v_load.origin_lat IS NULL OR v_load.origin_lng IS NULL
    OR v_load.destination_lat IS NULL OR v_load.destination_lng IS NULL THEN
    RAISE EXCEPTION 'The GPS order must have valid route coordinates' USING ERRCODE = '22023';
  END IF;

  IF p_snapped_origin_lat IS NULL OR p_snapped_origin_lng IS NULL
    OR p_snapped_destination_lat IS NULL OR p_snapped_destination_lng IS NULL
    OR p_snapped_origin_lat NOT BETWEEN -18.5 AND -4.2
    OR p_snapped_destination_lat NOT BETWEEN -18.5 AND -4.2
    OR p_snapped_origin_lng NOT BETWEEN 11.4 AND 24.2
    OR p_snapped_destination_lng NOT BETWEEN 11.4 AND 24.2 THEN
    RAISE EXCEPTION 'The road router returned invalid snapped GPS coordinates' USING ERRCODE = '22023';
  END IF;

  -- Independently verify that the router did not move either endpoint too far
  -- from the original order coordinates. This prevents client-supplied fake snaps.
  v_latitude_delta := radians(p_snapped_origin_lat - v_load.origin_lat);
  v_longitude_delta := radians(p_snapped_origin_lng - v_load.origin_lng);
  v_snap_haversine := power(sin(v_latitude_delta / 2), 2)
    + cos(radians(v_load.origin_lat)) * cos(radians(p_snapped_origin_lat))
    * power(sin(v_longitude_delta / 2), 2);
  v_origin_snap_distance_km := 2 * 6371 * asin(least(1, sqrt(v_snap_haversine)));

  v_latitude_delta := radians(p_snapped_destination_lat - v_load.destination_lat);
  v_longitude_delta := radians(p_snapped_destination_lng - v_load.destination_lng);
  v_snap_haversine := power(sin(v_latitude_delta / 2), 2)
    + cos(radians(v_load.destination_lat)) * cos(radians(p_snapped_destination_lat))
    * power(sin(v_longitude_delta / 2), 2);
  v_destination_snap_distance_km := 2 * 6371 * asin(least(1, sqrt(v_snap_haversine)));

  IF v_origin_snap_distance_km > 25 OR v_destination_snap_distance_km > 25 THEN
    RAISE EXCEPTION 'The road network is too far from one of the GPS points. Review the pickup and destination locations.'
      USING ERRCODE = '22023';
  END IF;

  -- Compare the road distance with OSRM's actual snapped road endpoints,
  -- not the unsnapped GPS points that may lie away from rural roads.
  v_latitude_delta := radians(p_snapped_destination_lat - p_snapped_origin_lat);
  v_longitude_delta := radians(p_snapped_destination_lng - p_snapped_origin_lng);
  v_haversine := power(sin(v_latitude_delta / 2), 2)
    + cos(radians(p_snapped_origin_lat)) * cos(radians(p_snapped_destination_lat))
    * power(sin(v_longitude_delta / 2), 2);
  v_minimum_distance_km := 2 * 6371 * asin(least(1, sqrt(v_haversine)));

  IF p_route_distance_km < v_minimum_distance_km * 0.95
    OR p_route_distance_km > greatest(v_minimum_distance_km * 10, v_minimum_distance_km + 50) THEN
    RAISE EXCEPTION 'Calculated road distance is inconsistent with the road-adjusted GPS points. Recalculate the route.'
      USING ERRCODE = '22023';
  END IF;

  IF p_price_method = 'manual' THEN
    IF p_manual_price IS NULL OR p_manual_price < 0.01 OR p_manual_price > 1000000000000
      OR p_manual_price::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'Enter a valid manual delivery price' USING ERRCODE = '22023';
    END IF;
    v_price := round(p_manual_price, 2);
  ELSIF p_price_method = 'suggested' THEN
    SELECT settings.base_fare_kz, settings.rate_per_km_kz,
      settings.rate_per_100kg_kz, settings.category_multipliers
    INTO v_base_fare, v_rate_per_km, v_rate_per_100kg, v_category_multipliers
    FROM public.freight_pricing_settings AS settings
    WHERE settings.id = true;

    IF v_base_fare IS NULL OR v_rate_per_km IS NULL OR v_rate_per_100kg IS NULL THEN
      RAISE EXCEPTION 'AgriLink has not completed the automatic pricing configuration' USING ERRCODE = '22023';
    END IF;

    SELECT lower(btrim(product.category)) INTO v_product_category
    FROM public.products AS product WHERE product.id = v_load.product_id;

    v_category_multiplier := coalesce(
      (v_category_multipliers ->> coalesce(v_product_category, ''))::numeric, 1
    );
    v_price := round((
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
  SET driver_id = v_actor_id,
    vehicle_id = v_vehicle.id,
    status = 'accepted',
    accepted_at = now(),
    driver_offered_price = v_price,
    driver_price_method = p_price_method,
    driver_quote_status = 'pending_buyer_approval',
    route_distance_km = p_route_distance_km,
    route_duration_minutes = p_route_duration_minutes,
    driver_commitment_confirmed_at = now(),
    updated_at = now()
  WHERE fl.id = p_freight_load_id
  RETURNING fl.* INTO v_load;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  SELECT pre_order.user_id, 'pre_order', 'Preço de transporte para aprovação',
    format('O motorista propôs %s Kz para transportar %s kg. Aprove o preço no seu perfil antes do início da viagem.',
      to_char(v_load.driver_offered_price, 'FM999G999G999G990D00'), v_load.weight_kg),
    jsonb_build_object('pre_order_id', pre_order.id, 'freight_load_id', v_load.id)
  FROM public.pre_orders AS pre_order WHERE pre_order.id = v_load.pre_order_id;

  RETURN QUERY SELECT v_load.id, v_load.status, v_load.driver_id,
    v_load.driver_offered_price, v_load.driver_price_method,
    v_load.driver_quote_status, v_load.route_distance_km, v_load.route_duration_minutes;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_freight_load(
  p_freight_load_id uuid,
  p_vehicle_id uuid,
  p_driver_commitment_confirmed boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  accepted_id uuid;
  v_vehicle public.driver_vehicles%ROWTYPE;
  v_license public.driver_licenses%ROWTYPE;
  registered_user_type text;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_driver_commitment_confirmed IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Confirm your availability and delivery commitments before accepting this freight load'
      USING ERRCODE = '42501';
  END IF;

  SELECT u.user_type::text
    INTO registered_user_type
  FROM public.users AS u WHERE u.id = actor_id FOR SHARE;

  IF NOT FOUND OR registered_user_type <> 'motorista' THEN
    RAISE EXCEPTION 'Only a registered driver can accept freight loads' USING ERRCODE = '42501';
  END IF;

  SELECT dl.* INTO v_license
  FROM public.driver_licenses AS dl
  WHERE dl.driver_id = actor_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Complete your driving licence details in your personal profile before accepting freight'
      USING ERRCODE = '42501';
  END IF;
  IF v_license.verification_status = 'rejected'
    OR v_license.issued_at > current_date
    OR v_license.expires_at < current_date THEN
    RAISE EXCEPTION 'Your driving licence is rejected, not yet valid or expired'
      USING ERRCODE = '42501';
  END IF;

  SELECT dv.* INTO v_vehicle
  FROM public.driver_vehicles AS dv
  WHERE dv.id = p_vehicle_id AND dv.driver_id = actor_id AND dv.is_active = true
    AND dv.verification_status <> 'rejected'
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Register and select an active vehicle before accepting freight' USING ERRCODE = '42501';
  END IF;

  IF v_vehicle.capacity_kg <= 0 THEN
    RAISE EXCEPTION 'A valid vehicle capacity is required' USING ERRCODE = '22023';
  END IF;
  IF NOT v_vehicle.brakes_ok OR NOT v_vehicle.tires_ok OR NOT v_vehicle.lights_ok
    OR v_vehicle.body_condition = 'needs_attention' THEN
    RAISE EXCEPTION 'The selected vehicle does not meet minimum safety requirements' USING ERRCODE = '22023';
  END IF;

  IF v_vehicle.maintenance_valid_until IS NULL OR v_vehicle.maintenance_valid_until < current_date THEN
    RAISE EXCEPTION 'A manutenção preventiva do veículo está em falta ou fora da validade. Actualize o registo antes de aceitar cargas.' USING ERRCODE = '22023';
  END IF;
  IF v_vehicle.inspection_valid_until IS NULL OR v_vehicle.inspection_valid_until < current_date
    OR v_vehicle.insurance_valid_until IS NULL OR v_vehicle.insurance_valid_until < current_date THEN
    RAISE EXCEPTION 'A inspecção e o seguro do veículo devem estar válidos antes de aceitar cargas.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.freight_loads
  SET driver_id = actor_id, vehicle_id = v_vehicle.id, status = 'accepted',
    accepted_at = now(), driver_commitment_confirmed_at = now()
  WHERE id = p_freight_load_id AND status IN ('available', 'open', 'agendado') AND driver_id IS NULL
    AND weight_kg > 0 AND weight_kg <= v_vehicle.capacity_kg
  RETURNING id INTO accepted_id;

  IF accepted_id IS NULL THEN
    RAISE EXCEPTION 'Freight load is no longer available or exceeds selected vehicle capacity' USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.freight_load_events (freight_load_id, actor_id, event_type)
  VALUES (accepted_id, actor_id, 'accepted');

  RETURN accepted_id;
END;
$function$;

-- Remove previous RPC signatures so the commitment cannot be bypassed by calling the old overloads.
DROP FUNCTION IF EXISTS public.submit_freight_quote(uuid,text,numeric,numeric,integer,uuid,double precision,double precision,double precision,double precision);
DROP FUNCTION IF EXISTS public.accept_freight_load(uuid,uuid);

REVOKE ALL ON FUNCTION public.submit_freight_quote(uuid,text,numeric,numeric,integer,uuid,double precision,double precision,double precision,double precision,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_freight_quote(uuid,text,numeric,numeric,integer,uuid,double precision,double precision,double precision,double precision,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.accept_freight_load(uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_freight_load(uuid,uuid,boolean) TO authenticated;
