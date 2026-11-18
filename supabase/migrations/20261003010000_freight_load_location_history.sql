-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261003010000; original ledger name: freight_load_location_history.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

CREATE TABLE IF NOT EXISTS public.freight_load_location_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_load_id uuid NOT NULL REFERENCES public.freight_loads(id) ON DELETE CASCADE,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_m double precision CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
  speed_mps double precision CHECK (speed_mps IS NULL OR speed_mps >= 0),
  heading_deg double precision CHECK (heading_deg IS NULL OR heading_deg BETWEEN 0 AND 360),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS freight_load_location_history_load_time_idx
  ON public.freight_load_location_history (freight_load_id, recorded_at);

CREATE INDEX IF NOT EXISTS freight_load_location_history_recorded_at_idx
  ON public.freight_load_location_history (recorded_at);

ALTER TABLE public.freight_load_location_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.freight_load_location_history FROM PUBLIC, anon;

GRANT SELECT ON public.freight_load_location_history TO authenticated;

DROP POLICY IF EXISTS "Freight parties can view location history" ON public.freight_load_location_history;

CREATE POLICY "Freight parties can view location history"
  ON public.freight_load_location_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.freight_loads AS load
      WHERE load.id = freight_load_id
        AND (
          load.created_by = auth.uid()
          OR load.driver_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  );

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
SET search_path = public
AS $$
DECLARE
  v_history_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.freight_loads AS load
    WHERE load.id = p_freight_load_id
      AND load.driver_id = auth.uid()
      AND load.status = 'in_transit'
  ) THEN
    RAISE EXCEPTION 'Only the assigned driver can share location while the load is in transit'
      USING ERRCODE = '42501';
  END IF;

  IF p_record_history THEN
    INSERT INTO public.freight_load_location_history (
      freight_load_id,
      latitude,
      longitude,
      accuracy_m,
      speed_mps,
      heading_deg
    )
    VALUES (
      p_freight_load_id,
      p_latitude,
      p_longitude,
      p_accuracy_m,
      p_speed_mps,
      p_heading_deg
    )
    RETURNING id INTO v_history_id;
  END IF;

  INSERT INTO public.freight_load_locations (
    freight_load_id,
    latitude,
    longitude,
    accuracy_m,
    speed_mps,
    heading_deg
  )
  VALUES (
    p_freight_load_id,
    p_latitude,
    p_longitude,
    p_accuracy_m,
    p_speed_mps,
    p_heading_deg
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
$$;

REVOKE ALL ON FUNCTION public.record_freight_load_location(
  uuid, double precision, double precision, double precision, double precision, double precision, boolean
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_freight_load_location(
  uuid, double precision, double precision, double precision, double precision, double precision, boolean
) TO authenticated;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'cleanup-freight-load-location-history';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'cleanup-freight-load-location-history',
    '17 * * * *',
    $command$
      DELETE FROM public.freight_load_location_history
      WHERE recorded_at < now() - interval '90 days'
    $command$
  );
END;
$$;
