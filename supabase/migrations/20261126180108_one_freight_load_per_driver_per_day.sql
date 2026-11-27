-- Enforce one freight assignment per driver per Angola calendar day.
-- The trigger serializes concurrent assignments; the unique index is the final invariant.
CREATE OR REPLACE FUNCTION public.enforce_one_driver_freight_load_per_day()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_load_day date;
  v_existing_load_id uuid;
BEGIN
  IF NEW.driver_id IS NULL OR NEW.accepted_at IS NULL THEN
    RETURN NEW;
  END IF;

  v_load_day := (NEW.accepted_at AT TIME ZONE 'Africa/Luanda')::date;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.driver_id::text || ':' || v_load_day::text, 0)
  );

  SELECT fl.id
    INTO v_existing_load_id
  FROM public.freight_loads AS fl
  WHERE fl.driver_id = NEW.driver_id
    AND fl.id <> NEW.id
    AND fl.accepted_at IS NOT NULL
    AND (fl.accepted_at AT TIME ZONE 'Africa/Luanda')::date = v_load_day
  LIMIT 1;

  IF v_existing_load_id IS NOT NULL THEN
    RAISE EXCEPTION 'Um motorista só pode aceitar uma carga por dia (hora de Angola).'
      USING ERRCODE = '23505',
            CONSTRAINT = 'freight_loads_one_driver_load_per_day';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_one_driver_freight_load_per_day ON public.freight_loads;
CREATE TRIGGER trg_enforce_one_driver_freight_load_per_day
  BEFORE INSERT OR UPDATE OF driver_id, accepted_at
  ON public.freight_loads
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_one_driver_freight_load_per_day();

CREATE UNIQUE INDEX IF NOT EXISTS freight_loads_one_driver_load_per_day_uidx
  ON public.freight_loads (
    driver_id,
    ((accepted_at AT TIME ZONE 'Africa/Luanda')::date)
  )
  WHERE driver_id IS NOT NULL AND accepted_at IS NOT NULL;

REVOKE ALL ON FUNCTION public.enforce_one_driver_freight_load_per_day() FROM PUBLIC, anon, authenticated;
