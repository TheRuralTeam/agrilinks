CREATE OR REPLACE FUNCTION public.set_freight_load_route_details(
  p_freight_load_id uuid,
  p_origin_lat double precision,
  p_origin_lng double precision,
  p_destination_lat double precision,
  p_destination_lng double precision,
  p_destination_label text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_user_type text;
  v_email_verified boolean;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT user_type::text, email_verified
    INTO v_user_type, v_email_verified
  FROM public.users
  WHERE id = v_actor_id;

  IF v_user_type IS DISTINCT FROM 'motorista' OR v_email_verified IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'A verified driver account is required' USING ERRCODE = '42501';
  END IF;

  IF p_origin_lat IS NULL OR p_origin_lng IS NULL
     OR p_destination_lat IS NULL OR p_destination_lng IS NULL
     OR p_origin_lat NOT BETWEEN -90 AND 90
     OR p_destination_lat NOT BETWEEN -90 AND 90
     OR p_origin_lng NOT BETWEEN -180 AND 180
     OR p_destination_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Valid origin and destination GPS coordinates are required' USING ERRCODE = '22023';
  END IF;

  IF p_destination_label IS NULL OR length(trim(p_destination_label)) < 3
     OR length(trim(p_destination_label)) > 180 THEN
    RAISE EXCEPTION 'A valid destination label is required' USING ERRCODE = '22023';
  END IF;

  UPDATE public.freight_loads
  SET origin_lat = p_origin_lat,
      origin_lng = p_origin_lng,
      destination_lat = p_destination_lat,
      destination_lng = p_destination_lng,
      destination_label = trim(p_destination_label),
      updated_at = now()
  WHERE id = p_freight_load_id
    AND status IN ('available', 'open', 'agendado')
    AND driver_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Freight load is no longer available' USING ERRCODE = '40001';
  END IF;

  RETURN p_freight_load_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_freight_load_route_details(uuid, double precision, double precision, double precision, double precision, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_freight_load_route_details(uuid, double precision, double precision, double precision, double precision, text) TO authenticated;