-- AgriLink: exigir pagamento confirmado em todas as transições de transporte
-- Evita que uma carga passe de in_transit para delivered/completed após alteração
-- inconsistente do estado financeiro do pedido.

CREATE OR REPLACE FUNCTION public.advance_freight_load_status(
  p_freight_load_id uuid,
  p_status text
)
RETURNS TABLE(
  id uuid,
  status text,
  driver_id uuid,
  in_transit_at timestamp with time zone,
  delivered_at timestamp with time zone
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
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;

  IF p_status NOT IN ('in_transit','delivered') THEN
    RAISE EXCEPTION 'Invalid freight load status' USING ERRCODE='22023';
  END IF;

  SELECT user_type::text, email_verified
  INTO v_user_type, v_email_verified
  FROM public.users
  WHERE id = v_actor_id;

  IF v_user_type IS DISTINCT FROM 'motorista'
    AND NOT public.has_role(v_actor_id,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only an eligible driver can update a freight load'
      USING ERRCODE='42501';
  END IF;

  IF v_email_verified IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'A verified email is required to update a freight load'
      USING ERRCODE='42501';
  END IF;

  SELECT *
  INTO v_load
  FROM public.freight_loads
  WHERE id = p_freight_load_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Freight load not found' USING ERRCODE='P0002';
  END IF;

  IF v_load.driver_id IS DISTINCT FROM v_actor_id
    AND NOT public.has_role(v_actor_id,'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only the assigned driver can update this freight load'
      USING ERRCODE='42501';
  END IF;

  IF v_load.pre_order_id IS NOT NULL THEN
    SELECT *
    INTO v_order
    FROM public.pre_orders
    WHERE id = v_load.pre_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Linked order not found' USING ERRCODE='P0002';
    END IF;

    -- Regra financeira obrigatória para iniciar e concluir o transporte.
    IF v_order.payment_status IS DISTINCT FROM 'paid' THEN
      RAISE EXCEPTION 'The order must be paid before transport status can advance'
        USING ERRCODE='42501';
    END IF;

    IF p_status = 'in_transit'
      AND v_load.driver_quote_status <> 'approved' THEN
      RAISE EXCEPTION 'The buyer must approve the driver delivery price before transport starts'
        USING ERRCODE='42501';
    END IF;
  END IF;

  IF NOT (
    (v_load.status='accepted' AND p_status='in_transit')
    OR
    (v_load.status='in_transit' AND p_status='delivered')
  ) THEN
    RAISE EXCEPTION 'Invalid freight load status transition'
      USING ERRCODE='22023';
  END IF;

  UPDATE public.freight_loads
  SET
    status = p_status,
    in_transit_at = CASE
      WHEN p_status='in_transit' THEN now()
      ELSE in_transit_at
    END,
    delivered_at = CASE
      WHEN p_status='delivered' THEN now()
      ELSE delivered_at
    END,
    updated_at = now()
  WHERE id = p_freight_load_id
    AND driver_id = v_load.driver_id
    AND status = v_load.status
  RETURNING * INTO v_load;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Freight load status changed concurrently'
      USING ERRCODE='40001';
  END IF;

  RETURN QUERY
    SELECT
      v_load.id,
      v_load.status::text,
      v_load.driver_id,
      v_load.in_transit_at,
      v_load.delivered_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.advance_freight_load_status(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.advance_freight_load_status(uuid,text) TO authenticated;
