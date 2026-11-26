-- Register a concrete vehicle before a driver can take a freight load.
CREATE TABLE IF NOT EXISTS public.driver_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vehicle_type text NOT NULL CHECK (length(btrim(vehicle_type)) BETWEEN 2 AND 80),
  make text NOT NULL CHECK (length(btrim(make)) BETWEEN 1 AND 80),
  model text NOT NULL CHECK (length(btrim(model)) BETWEEN 1 AND 100),
  plate_number text NOT NULL CHECK (length(regexp_replace(upper(btrim(plate_number)), '[^A-Z0-9]', '', 'g')) BETWEEN 5 AND 12),
  color text NOT NULL CHECK (length(btrim(color)) BETWEEN 2 AND 40),
  manufacture_year integer CHECK (manufacture_year BETWEEN 1950 AND 2100),
  capacity_kg numeric(12,2) NOT NULL CHECK (capacity_kg > 0 AND capacity_kg <= 1000000),
  condition_notes text NOT NULL CHECK (length(btrim(condition_notes)) BETWEEN 10 AND 1000),
  brakes_ok boolean NOT NULL,
  tires_ok boolean NOT NULL,
  lights_ok boolean NOT NULL,
  body_condition text NOT NULL CHECK (body_condition IN ('good','fair','needs_attention')),
  registration_document_number text,
  inspection_valid_until date,
  insurance_valid_until date,
  verification_status text NOT NULL DEFAULT 'pending_review' CHECK (verification_status IN ('pending_review','approved','rejected')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS driver_vehicles_plate_normalized_uidx
  ON public.driver_vehicles (regexp_replace(upper(btrim(plate_number)), '[^A-Z0-9]', '', 'g'));
CREATE INDEX IF NOT EXISTS driver_vehicles_driver_active_idx
  ON public.driver_vehicles (driver_id, is_active, created_at DESC);

ALTER TABLE public.driver_vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Drivers can view own vehicles" ON public.driver_vehicles;
CREATE POLICY "Drivers can view own vehicles"
  ON public.driver_vehicles FOR SELECT TO authenticated
  USING (driver_id = (SELECT auth.uid()) OR public.is_agrilink_admin());
DROP POLICY IF EXISTS "Drivers can register own vehicles" ON public.driver_vehicles;
-- Drivers can register and read their vehicles, but cannot self-approve or alter review state.
DROP POLICY IF EXISTS "Drivers can update own vehicles" ON public.driver_vehicles;
DROP POLICY IF EXISTS "Drivers can register own vehicles" ON public.driver_vehicles;
CREATE POLICY "Drivers can register own vehicles"
  ON public.driver_vehicles FOR INSERT TO authenticated
  WITH CHECK (
    driver_id = (SELECT auth.uid())
    AND verification_status = 'pending_review'
    AND is_active = true
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid()) AND u.user_type::text = 'motorista'
    )
  );

GRANT SELECT, INSERT ON public.driver_vehicles TO authenticated;

ALTER TABLE public.freight_loads
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.driver_vehicles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS freight_loads_vehicle_id_idx ON public.freight_loads(vehicle_id);

-- Retire the previous RPC signatures so a caller cannot bypass vehicle registration.
REVOKE ALL ON FUNCTION public.submit_freight_quote(uuid,text,numeric,numeric,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_freight_load(uuid) FROM PUBLIC, anon, authenticated;

-- Licence details must exist before the freight RPCs are defined and become callable.
CREATE TABLE IF NOT EXISTS public.driver_licenses (
  driver_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  license_number text NOT NULL,
  license_categories text[] NOT NULL DEFAULT '{}',
  issued_at date NOT NULL,
  expires_at date NOT NULL,
  issuing_authority text NOT NULL,
  verification_status text NOT NULL DEFAULT 'pending_review'
    CHECK (verification_status IN ('pending_review', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT driver_licenses_number_nonempty CHECK (length(btrim(license_number)) BETWEEN 3 AND 80),
  CONSTRAINT driver_licenses_categories_nonempty CHECK (cardinality(license_categories) > 0),
  CONSTRAINT driver_licenses_dates_valid CHECK (expires_at > issued_at),
  CONSTRAINT driver_licenses_authority_nonempty CHECK (length(btrim(issuing_authority)) BETWEEN 2 AND 160)
);

CREATE UNIQUE INDEX IF NOT EXISTS driver_licenses_number_normalized_uidx
  ON public.driver_licenses (upper(regexp_replace(license_number, '[[:space:]-]', '', 'g')));

ALTER TABLE public.driver_licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers can view own licence" ON public.driver_licenses;
CREATE POLICY "Drivers can view own licence"
  ON public.driver_licenses FOR SELECT TO authenticated
  USING (driver_id = (SELECT auth.uid()) OR public.is_agrilink_admin());

DROP POLICY IF EXISTS "Drivers can register own licence" ON public.driver_licenses;
CREATE POLICY "Drivers can register own licence"
  ON public.driver_licenses FOR INSERT TO authenticated
  WITH CHECK (
    driver_id = (SELECT auth.uid())
    AND verification_status = 'pending_review'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid()) AND u.user_type::text = 'motorista'
    )
  );

DROP POLICY IF EXISTS "Drivers can update own licence" ON public.driver_licenses;
CREATE POLICY "Drivers can update own licence"
  ON public.driver_licenses FOR UPDATE TO authenticated
  USING (driver_id = (SELECT auth.uid()))
  WITH CHECK (driver_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can manage driver licences" ON public.driver_licenses;
CREATE POLICY "Admins can manage driver licences"
  ON public.driver_licenses FOR ALL TO authenticated
  USING (public.is_agrilink_admin())
  WITH CHECK (public.is_agrilink_admin());

CREATE OR REPLACE FUNCTION public.protect_driver_license_review_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.is_agrilink_admin() AND (
    NEW.verification_status IS DISTINCT FROM OLD.verification_status
    OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
    OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
  ) THEN
    RAISE EXCEPTION 'Only an authorized administrator can change driver licence verification state'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_driver_license_review_fields ON public.driver_licenses;
CREATE TRIGGER trg_protect_driver_license_review_fields
  BEFORE UPDATE ON public.driver_licenses
  FOR EACH ROW EXECUTE FUNCTION public.protect_driver_license_review_fields();

GRANT SELECT, INSERT, UPDATE ON public.driver_licenses TO authenticated;
REVOKE ALL ON public.driver_licenses FROM anon;

CREATE OR REPLACE FUNCTION public.set_driver_license_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_driver_license_updated_at ON public.driver_licenses;
CREATE TRIGGER trg_driver_license_updated_at
  BEFORE UPDATE ON public.driver_licenses
  FOR EACH ROW EXECUTE FUNCTION public.set_driver_license_updated_at();

CREATE OR REPLACE FUNCTION public.submit_freight_quote(
  p_freight_load_id uuid,
  p_price_method text,
  p_manual_price numeric,
  p_route_distance_km numeric,
  p_route_duration_minutes integer,
  p_vehicle_id uuid
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
  v_latitude_delta double precision;
  v_longitude_delta double precision;
  v_haversine double precision;
  v_load public.freight_loads%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
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
  p_vehicle_id uuid
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

  UPDATE public.freight_loads
  SET driver_id = actor_id, vehicle_id = v_vehicle.id, status = 'accepted',
    accepted_at = now()
  WHERE id = p_freight_load_id AND status = 'open' AND driver_id IS NULL
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

REVOKE ALL ON FUNCTION public.submit_freight_quote(uuid,text,numeric,numeric,integer,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_freight_load(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_freight_quote(uuid,text,numeric,numeric,integer,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_freight_load(uuid,uuid) TO authenticated;
