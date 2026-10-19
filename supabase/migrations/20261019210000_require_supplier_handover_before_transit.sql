-- A viagem com mercadoria só pode começar após confirmação explícita do fornecedor.
BEGIN;

CREATE OR REPLACE FUNCTION public.confirm_supplier_handover(p_freight_load_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_load public.freight_loads%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT fl.* INTO v_load
  FROM public.freight_loads AS fl
  WHERE fl.id = p_freight_load_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Freight load not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_load.supplier_id IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'Only the assigned supplier can confirm handover' USING ERRCODE = '42501';
  END IF;

  IF v_load.status <> 'at_pickup' OR v_load.driver_id IS NULL THEN
    RAISE EXCEPTION 'The driver must be assigned and at the pickup point before supplier handover' USING ERRCODE = '22023';
  END IF;

  IF v_load.supplier_handover_confirmed_at IS NOT NULL THEN
    RETURN v_load.supplier_handover_confirmed_at;
  END IF;

  UPDATE public.freight_loads AS fl
  SET supplier_handover_confirmed_at = now(),
      updated_at = now()
  WHERE fl.id = p_freight_load_id
    AND fl.status = 'at_pickup'
    AND fl.supplier_handover_confirmed_at IS NULL
  RETURNING fl.* INTO v_load;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier handover state changed concurrently' USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.freight_load_events (freight_load_id, actor_id, event_type)
  VALUES (v_load.id, v_actor_id, 'supplier_handover');

  RETURN v_load.supplier_handover_confirmed_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_supplier_handover(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_supplier_handover(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.advance_freight_load_status(
  p_freight_load_id uuid,
  p_status text
)
RETURNS TABLE(
  id uuid,
  status text,
  driver_id uuid,
  in_transit_at timestamptz,
  delivered_at timestamptz
)
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
  v_event_type text;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('at_pickup', 'in_transit', 'delivered') THEN
    RAISE EXCEPTION 'Invalid freight load status' USING ERRCODE = '22023';
  END IF;

  SELECT u.user_type::text, u.email_verified
  INTO v_user_type, v_email_verified
  FROM public.users AS u
  WHERE u.id = v_actor_id;

  IF v_user_type IS DISTINCT FROM 'motorista'
     AND NOT public.has_role(v_actor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only the assigned driver or an authorized admin can update a freight load'
      USING ERRCODE = '42501';
  END IF;

  IF v_email_verified IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'A verified email is required to update a freight load'
      USING ERRCODE = '42501';
  END IF;

  SELECT fl.* INTO v_load
  FROM public.freight_loads AS fl
  WHERE fl.id = p_freight_load_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Freight load not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_load.driver_id IS DISTINCT FROM v_actor_id
     AND NOT public.has_role(v_actor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only the assigned driver can update this freight load'
      USING ERRCODE = '42501';
  END IF;

  IF v_load.pre_order_id IS NOT NULL AND p_status IN ('in_transit', 'delivered') THEN
    SELECT po.* INTO v_order
    FROM public.pre_orders AS po
    WHERE po.id = v_load.pre_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Linked order not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_order.payment_status IS DISTINCT FROM 'paid' THEN
      RAISE EXCEPTION 'The order must be paid before transport status can advance'
        USING ERRCODE = '42501';
    END IF;

    IF p_status = 'in_transit'
       AND v_load.driver_quote_status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'The buyer must approve the driver delivery price before transport starts'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_status = 'in_transit'
     AND v_load.supplier_handover_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'The supplier must confirm handing the goods to the driver before the trip starts'
      USING ERRCODE = '42501';
  END IF;

  IF NOT (
       (v_load.status = 'accepted' AND p_status = 'at_pickup')
    OR (v_load.status = 'at_pickup' AND p_status = 'in_transit'
        AND v_load.supplier_handover_confirmed_at IS NOT NULL)
    OR (v_load.status = 'in_transit' AND p_status = 'delivered')
  ) THEN
    RAISE EXCEPTION 'Invalid freight load status transition' USING ERRCODE = '22023';
  END IF;

  UPDATE public.freight_loads AS fl
  SET status = p_status,
      driver_arrived_at = CASE WHEN p_status = 'at_pickup' THEN COALESCE(fl.driver_arrived_at, now()) ELSE fl.driver_arrived_at END,
      driver_pickup_confirmed_at = CASE WHEN p_status = 'in_transit' THEN COALESCE(fl.driver_pickup_confirmed_at, now()) ELSE fl.driver_pickup_confirmed_at END,
      in_transit_at = CASE WHEN p_status = 'in_transit' THEN COALESCE(fl.in_transit_at, now()) ELSE fl.in_transit_at END,
      delivered_at = CASE WHEN p_status = 'delivered' THEN COALESCE(fl.delivered_at, now()) ELSE fl.delivered_at END,
      driver_delivery_confirmed_at = CASE WHEN p_status = 'delivered' THEN COALESCE(fl.driver_delivery_confirmed_at, now()) ELSE fl.driver_delivery_confirmed_at END,
      updated_at = now()
  WHERE fl.id = p_freight_load_id
    AND fl.driver_id = v_load.driver_id
    AND fl.status = v_load.status
  RETURNING fl.* INTO v_load;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Freight load status changed concurrently' USING ERRCODE = '40001';
  END IF;

  v_event_type := CASE p_status
    WHEN 'at_pickup' THEN 'driver_pickup'
    WHEN 'in_transit' THEN 'trip_started'
    WHEN 'delivered' THEN 'driver_delivery'
  END;

  INSERT INTO public.freight_load_events (freight_load_id, actor_id, event_type)
  VALUES (v_load.id, v_actor_id, v_event_type);

  IF p_status = 'delivered' THEN
    PERFORM public.create_freight_settlement_if_ready(v_load.id);
  END IF;

  RETURN QUERY SELECT v_load.id, v_load.status::text, v_load.driver_id, v_load.in_transit_at, v_load.delivered_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.advance_freight_load_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_freight_load_status(uuid, text) TO authenticated;

COMMIT;
