-- Prevent user-editable JWT metadata from authorizing freight acceptance.
-- Driver role and vehicle capacity are read only from public.users.
CREATE OR REPLACE FUNCTION public.accept_freight_load(p_freight_load_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  accepted_id uuid;
  registered_capacity numeric;
  registered_user_type text;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT u.user_type::text, u.load_capacity_kg
    INTO registered_user_type, registered_capacity
  FROM public.users AS u
  WHERE u.id = actor_id
  FOR SHARE;

  IF NOT FOUND OR registered_user_type <> 'motorista' THEN
    RAISE EXCEPTION 'Only a registered driver can accept freight loads';
  END IF;

  IF registered_capacity IS NULL OR registered_capacity <= 0 THEN
    RAISE EXCEPTION 'A valid vehicle capacity is required';
  END IF;

  UPDATE public.freight_loads
  SET driver_id = actor_id,
      status = 'accepted',
      accepted_at = now()
  WHERE id = p_freight_load_id
    AND status = 'open'
    AND driver_id IS NULL
    AND weight_kg > 0
    AND weight_kg <= registered_capacity
  RETURNING id INTO accepted_id;

  IF accepted_id IS NULL THEN
    RAISE EXCEPTION 'Freight load is no longer available or exceeds vehicle capacity';
  END IF;

  INSERT INTO public.freight_load_events (freight_load_id, actor_id, event_type)
  VALUES (accepted_id, actor_id, 'accepted');

  RETURN accepted_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_freight_load(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_freight_load(uuid) TO authenticated;
