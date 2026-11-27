-- Repair driver load acceptance and introduce an explicit pickup confirmation before GPS tracking.
ALTER TABLE public.freight_loads
  ADD COLUMN IF NOT EXISTS driver_arrived_at timestamptz;

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
  v_user_type text;
  v_email_verified boolean;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;

  SELECT user_type::text, email_verified, load_capacity_kg
    INTO v_user_type, v_email_verified, registered_capacity
  FROM public.users
  WHERE id = actor_id;

  IF v_user_type IS DISTINCT FROM 'motorista' THEN
    RAISE EXCEPTION 'Only a registered driver can accept freight loads' USING ERRCODE='42501';
  END IF;
  IF v_email_verified IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'A verified email is required to accept a freight load' USING ERRCODE='42501';
  END IF;
  IF registered_capacity IS NULL OR registered_capacity <= 0 THEN
    RAISE EXCEPTION 'A valid vehicle capacity is required' USING ERRCODE='22023';
  END IF;

  UPDATE public.freight_loads
  SET driver_id = actor_id,
      status = 'accepted',
      accepted_at = now(),
      updated_at = now()
  WHERE id = p_freight_load_id
    AND status IN ('available', 'open', 'agendado')
    AND driver_id IS NULL
    AND created_by <> actor_id
    AND weight_kg <= registered_capacity
  RETURNING id INTO accepted_id;

  IF accepted_id IS NULL THEN
    RAISE EXCEPTION 'Freight load is no longer available or exceeds vehicle capacity' USING ERRCODE='40001';
  END IF;

  INSERT INTO public.freight_load_events (freight_load_id, actor_id, event_type)
  VALUES (accepted_id, actor_id, 'accepted');

  RETURN accepted_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.advance_freight_load_status(p_freight_load_id uuid, p_status text)
RETURNS TABLE(id uuid, status text, driver_id uuid, in_transit_at timestamptz, delivered_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_user_type text;
  v_email_verified boolean;
  v_load public.freight_loads%ROWTYPE;
  v_order public.pre_orders%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('at_pickup','in_transit','delivered') THEN
    RAISE EXCEPTION 'Invalid freight load status' USING ERRCODE='22023';
  END IF;

  SELECT user_type::text, email_verified
  INTO v_user_type, v_email_verified
  FROM public.users WHERE id=v_actor_id;

  IF v_user_type IS DISTINCT FROM 'motorista'
    AND NOT public.has_role(v_actor_id,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only an eligible driver can update a freight load' USING ERRCODE='42501';
  END IF;
  IF v_email_verified IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'A verified email is required to update a freight load' USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_load FROM public.freight_loads WHERE public.freight_loads.id=p_freight_load_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Freight load not found' USING ERRCODE='P0002'; END IF;

  IF v_load.driver_id IS DISTINCT FROM v_actor_id
    AND NOT public.has_role(v_actor_id,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only the assigned driver can update this freight load' USING ERRCODE='42501';
  END IF;

  IF v_load.pre_order_id IS NOT NULL AND p_status IN ('in_transit','delivered') THEN
    SELECT * INTO v_order FROM public.pre_orders WHERE public.pre_orders.id=v_load.pre_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Linked order not found' USING ERRCODE='P0002'; END IF;
    IF v_order.payment_status IS DISTINCT FROM 'paid' THEN
      RAISE EXCEPTION 'The order must be paid before transport status can advance' USING ERRCODE='42501';
    END IF;
    IF p_status='in_transit' AND v_load.driver_quote_status <> 'approved' THEN
      RAISE EXCEPTION 'The buyer must approve the driver delivery price before transport starts' USING ERRCODE='42501';
    END IF;
  END IF;

  IF NOT (
       (v_load.status='accepted' AND p_status='at_pickup')
    OR (v_load.status='at_pickup' AND p_status='in_transit')
    OR (v_load.status='in_transit' AND p_status='delivered')
  ) THEN
    RAISE EXCEPTION 'Invalid freight load status transition' USING ERRCODE='22023';
  END IF;

  UPDATE public.freight_loads
  SET status=p_status,
      driver_arrived_at=CASE WHEN p_status='at_pickup' THEN now() ELSE driver_arrived_at END,
      driver_pickup_confirmed_at=CASE WHEN p_status='in_transit' THEN now() ELSE driver_pickup_confirmed_at END,
      in_transit_at=CASE WHEN p_status='in_transit' THEN now() ELSE in_transit_at END,
      delivered_at=CASE WHEN p_status='delivered' THEN now() ELSE delivered_at END,
      updated_at=now()
  WHERE public.freight_loads.id=p_freight_load_id
    AND public.freight_loads.driver_id=v_load.driver_id
    AND public.freight_loads.status=v_load.status
  RETURNING * INTO v_load;

  IF NOT FOUND THEN RAISE EXCEPTION 'Freight load status changed concurrently' USING ERRCODE='40001'; END IF;

  INSERT INTO public.freight_load_events (freight_load_id, actor_id, event_type)
  VALUES (v_load.id, v_actor_id, p_status);

  RETURN QUERY SELECT v_load.id, v_load.status::text, v_load.driver_id, v_load.in_transit_at, v_load.delivered_at;
END;
$function$;
