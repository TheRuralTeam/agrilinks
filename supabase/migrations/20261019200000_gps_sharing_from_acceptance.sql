-- Permite telemetria GPS durante todo o ciclo de transporte:
-- desde a aceitação da carga, incluindo deslocação para recolha e trânsito,
-- até o motorista confirmar a entrega. Cargas entregues/canceladas ficam bloqueadas.
CREATE OR REPLACE FUNCTION public.record_freight_load_location(
  p_freight_load_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision,
  p_speed_mps double precision,
  p_heading_deg double precision,
  p_record_history boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_history_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.freight_loads AS load
    WHERE load.id = p_freight_load_id
      AND load.driver_id = auth.uid()
      AND load.status IN ('accepted', 'at_pickup', 'in_transit')
  ) THEN
    RAISE EXCEPTION 'Only the assigned driver can share location from acceptance until delivery'
      USING ERRCODE = '42501';
  END IF;

  IF p_latitude IS NULL OR p_longitude IS NULL
    OR p_latitude < -90 OR p_latitude > 90
    OR p_longitude < -180 OR p_longitude > 180 THEN
    RAISE EXCEPTION 'Invalid GPS coordinates' USING ERRCODE = '22023';
  END IF;

  IF p_accuracy_m IS NOT NULL AND (p_accuracy_m < 0 OR p_accuracy_m > 100000) THEN
    RAISE EXCEPTION 'Invalid GPS accuracy' USING ERRCODE = '22023';
  END IF;

  IF p_speed_mps IS NOT NULL AND (p_speed_mps < 0 OR p_speed_mps > 100) THEN
    RAISE EXCEPTION 'Invalid GPS speed' USING ERRCODE = '22023';
  END IF;

  IF p_heading_deg IS NOT NULL AND (p_heading_deg < 0 OR p_heading_deg >= 360) THEN
    RAISE EXCEPTION 'Invalid GPS heading' USING ERRCODE = '22023';
  END IF;

  IF p_record_history THEN
    INSERT INTO public.freight_load_location_history (
      freight_load_id, latitude, longitude, accuracy_m, speed_mps, heading_deg
    )
    VALUES (
      p_freight_load_id, p_latitude, p_longitude, p_accuracy_m, p_speed_mps, p_heading_deg
    )
    RETURNING id INTO v_history_id;
  END IF;

  INSERT INTO public.freight_load_locations (
    freight_load_id, latitude, longitude, accuracy_m, speed_mps, heading_deg
  )
  VALUES (
    p_freight_load_id, p_latitude, p_longitude, p_accuracy_m, p_speed_mps, p_heading_deg
  )
  ON CONFLICT (freight_load_id) DO UPDATE
  SET latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      accuracy_m = EXCLUDED.accuracy_m,
      speed_mps = EXCLUDED.speed_mps,
      heading_deg = EXCLUDED.heading_deg,
      recorded_at = now();

  RETURN v_history_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_freight_load_location(uuid, double precision, double precision, double precision, double precision, double precision, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_freight_load_location(uuid, double precision, double precision, double precision, double precision, double precision, boolean) TO authenticated;
