ALTER TABLE public.freight_loads
  ADD COLUMN IF NOT EXISTS buyer_quote_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supplier_quote_approved boolean NOT NULL DEFAULT false;

DROP TRIGGER IF EXISTS trg_create_freight_load_for_accepted_pre_order ON public.pre_orders;
CREATE TRIGGER trg_create_freight_load_for_accepted_pre_order
  AFTER UPDATE OF status ON public.pre_orders
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.create_freight_load_for_accepted_pre_order();

CREATE OR REPLACE FUNCTION public.notify_verified_drivers_of_preorder_load()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.pre_order_id IS NULL OR NEW.status <> 'available' THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  SELECT u.id, 'freight_load', 'Nova pré-compra para transporte',
    format('O produto %s tem um pedido aceite de %s kg, de %s para %s. Abre Cargas para rever a rota e apresentar o teu preço.',
      NEW.product_name, to_char(NEW.weight_kg, 'FM999G999G999G990D00'), NEW.origin_label, NEW.destination_label),
    jsonb_build_object('pre_order_id', NEW.pre_order_id, 'freight_load_id', NEW.id, 'path', '/cargas')
  FROM public.users AS u
  WHERE u.user_type::text = 'motorista'
    AND u.email_verified IS TRUE
    AND u.load_capacity_kg IS NOT NULL
    AND u.load_capacity_kg > 0
    AND u.load_capacity_kg >= NEW.weight_kg
    AND u.id <> NEW.created_by;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_verified_drivers_of_preorder_load() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_notify_verified_drivers_of_preorder_load ON public.freight_loads;
CREATE TRIGGER trg_notify_verified_drivers_of_preorder_load
  AFTER INSERT ON public.freight_loads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_verified_drivers_of_preorder_load();

CREATE OR REPLACE FUNCTION public.notify_supplier_of_driver_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_supplier_id uuid;
BEGIN
  IF NEW.pre_order_id IS NULL
    OR NEW.driver_quote_status IS DISTINCT FROM 'pending_buyer_approval'
    OR OLD.driver_quote_status = 'pending_buyer_approval' THEN
    RETURN NEW;
  END IF;

  v_supplier_id := NEW.supplier_id;
  IF v_supplier_id IS NULL THEN
    SELECT p.user_id INTO v_supplier_id FROM public.products AS p WHERE p.id = NEW.product_id;
  END IF;

  IF v_supplier_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      v_supplier_id,
      'freight_quote',
      'Proposta de transporte recebida',
      format('Um motorista propôs %s Kz para transportar %s kg de %s para %s. O pagamento só será liberado depois da tua aprovação e da aprovação do comprador.',
        to_char(NEW.driver_offered_price, 'FM999G999G999G990D00'),
        to_char(NEW.weight_kg, 'FM999G999G999G990D00'), NEW.origin_label, NEW.destination_label),
      jsonb_build_object('pre_order_id', NEW.pre_order_id, 'freight_load_id', NEW.id, 'path', '/perfil?tab=orders')
    );
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_supplier_of_driver_quote() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_notify_supplier_of_driver_quote ON public.freight_loads;
CREATE TRIGGER trg_notify_supplier_of_driver_quote
  AFTER UPDATE OF driver_quote_status ON public.freight_loads
  FOR EACH ROW
  WHEN (NEW.driver_quote_status = 'pending_buyer_approval')
  EXECUTE FUNCTION public.notify_supplier_of_driver_quote();

UPDATE public.freight_loads
SET buyer_quote_approved = true,
    supplier_quote_approved = true
WHERE driver_quote_status = 'approved';

CREATE OR REPLACE FUNCTION public.submit_freight_quote(
  p_freight_load_id uuid,
  p_price_method text,
  p_manual_price numeric,
  p_route_distance_km numeric,
  p_route_duration_minutes integer
)
RETURNS TABLE(
  id uuid, status text, driver_id uuid, driver_offered_price numeric,
  driver_price_method text, driver_quote_status text,
  route_distance_km numeric, route_duration_minutes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_user_type text;
  v_capacity numeric;
  v_email_verified boolean;
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
  v_load public.freight_loads%rowtype;
  v_is_revision boolean;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT u.user_type::text, u.load_capacity_kg, u.email_verified
  INTO v_user_type, v_capacity, v_email_verified
  FROM public.users AS u
  WHERE u.id = v_actor_id
  FOR SHARE;

  IF v_user_type IS DISTINCT FROM 'motorista' OR v_email_verified IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Only a verified driver can submit a delivery price' USING ERRCODE = '42501';
  END IF;
  IF v_capacity IS NULL OR v_capacity <= 0 THEN
    RAISE EXCEPTION 'A valid vehicle capacity is required' USING ERRCODE = '22023';
  END IF;

  SELECT fl.* INTO v_load
  FROM public.freight_loads AS fl
  WHERE fl.id = p_freight_load_id
  FOR UPDATE;

  IF NOT FOUND OR v_load.pre_order_id IS NULL THEN
    RAISE EXCEPTION 'GPS order load not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_load.weight_kg <= 0 OR v_load.weight_kg > v_capacity THEN
    RAISE EXCEPTION 'Freight load exceeds vehicle capacity' USING ERRCODE = '22023';
  END IF;

  v_is_revision := v_load.status = 'accepted'
    AND v_load.driver_id = v_actor_id
    AND v_load.driver_quote_status = 'rejected';

  IF NOT v_is_revision AND (
    v_load.status NOT IN ('available', 'open', 'agendado')
    OR v_load.driver_id IS NOT NULL
    OR v_load.created_by = v_actor_id
  ) THEN
    RAISE EXCEPTION 'This freight load is no longer available' USING ERRCODE = '40001';
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
    FROM public.products AS product
    WHERE product.id = v_load.product_id;

    v_category_multiplier := coalesce(
      (v_category_multipliers ->> coalesce(v_product_category, ''))::numeric, 1
    );
    v_price := round((v_base_fare + (p_route_distance_km * v_rate_per_km)
      + ((v_load.weight_kg / 100) * v_rate_per_100kg)) * v_category_multiplier, 2);
    IF v_price <= 0 OR v_price > 1000000000000 THEN
      RAISE EXCEPTION 'The suggested delivery price is invalid' USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'Choose manual or suggested freight pricing' USING ERRCODE = '22023';
  END IF;

  UPDATE public.freight_loads AS fl
  SET driver_id = v_actor_id,
      status = 'accepted',
      accepted_at = coalesce(fl.accepted_at, now()),
      driver_offered_price = v_price,
      driver_price_method = p_price_method,
      driver_quote_status = 'pending_buyer_approval',
      buyer_quote_approved = false,
      supplier_quote_approved = false,
      route_distance_km = p_route_distance_km,
      route_duration_minutes = p_route_duration_minutes,
      updated_at = now()
  WHERE fl.id = p_freight_load_id
  RETURNING fl.* INTO v_load;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  SELECT po.user_id, 'freight_quote', 'Preço de transporte proposto',
    format('O motorista propôs %s Kz para transportar %s kg. O fornecedor e tu precisam aprovar esta proposta antes do pagamento.',
      to_char(v_load.driver_offered_price, 'FM999G999G999G990D00'),
      to_char(v_load.weight_kg, 'FM999G999G999G990D00')),
    jsonb_build_object('pre_order_id', po.id, 'freight_load_id', v_load.id, 'path', '/perfil?tab=orders')
  FROM public.pre_orders AS po
  WHERE po.id = v_load.pre_order_id;

  RETURN QUERY SELECT v_load.id, v_load.status, v_load.driver_id,
    v_load.driver_offered_price, v_load.driver_price_method, v_load.driver_quote_status,
    v_load.route_distance_km, v_load.route_duration_minutes;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_freight_quote(uuid, text, numeric, numeric, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_freight_quote(uuid, text, numeric, numeric, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_freight_quote(
  p_freight_load_id uuid,
  p_approved boolean
)
RETURNS TABLE(id uuid, status text, driver_offered_price numeric, driver_quote_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_load public.freight_loads%rowtype;
  v_buyer_id uuid;
  v_supplier_id uuid;
  v_buyer_approved boolean;
  v_supplier_approved boolean;
  v_quote_status text;
  v_message text;
BEGIN
  IF v_actor_id IS NULL OR p_freight_load_id IS NULL OR p_approved IS NULL THEN
    RAISE EXCEPTION 'Invalid freight quote response' USING ERRCODE = '42501';
  END IF;

  SELECT fl.* INTO v_load
  FROM public.freight_loads AS fl
  WHERE fl.id = p_freight_load_id AND fl.pre_order_id IS NOT NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Freight quote not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_load.driver_quote_status <> 'pending_buyer_approval' THEN
    RAISE EXCEPTION 'This freight quote is no longer open for negotiation' USING ERRCODE = '22023';
  END IF;

  SELECT po.user_id, coalesce(v_load.supplier_id, p.user_id)
  INTO v_buyer_id, v_supplier_id
  FROM public.pre_orders AS po
  JOIN public.products AS p ON p.id = po.product_id
  WHERE po.id = v_load.pre_order_id;
  IF v_buyer_id IS NULL OR v_supplier_id IS NULL THEN
    RAISE EXCEPTION 'Freight negotiation parties could not be resolved' USING ERRCODE = 'P0002';
  END IF;
  IF v_actor_id <> v_buyer_id AND v_actor_id <> v_supplier_id THEN
    RAISE EXCEPTION 'Only the buyer and supplier may respond to a freight quote' USING ERRCODE = '42501';
  END IF;

  v_buyer_approved := coalesce(v_load.buyer_quote_approved, false);
  v_supplier_approved := coalesce(v_load.supplier_quote_approved, false);
  IF v_actor_id = v_buyer_id THEN
    v_buyer_approved := p_approved;
  ELSE
    v_supplier_approved := p_approved;
  END IF;

  IF NOT p_approved THEN
    v_quote_status := 'rejected';
    v_message := 'Uma das partes recusou a proposta de transporte. O motorista pode rever o preço e enviar uma nova proposta.';
  ELSIF v_buyer_approved AND v_supplier_approved THEN
    v_quote_status := 'approved';
    v_message := 'Comprador e fornecedor aprovaram o preço de transporte. O total final pode agora ser preparado para pagamento.';
  ELSE
    v_quote_status := 'pending_buyer_approval';
    v_message := CASE
      WHEN v_actor_id = v_buyer_id THEN 'O comprador aprovou o transporte. Falta a confirmação do fornecedor.'
      ELSE 'O fornecedor aprovou o transporte. Falta a confirmação do comprador.'
    END;
  END IF;

  UPDATE public.freight_loads AS fl
  SET buyer_quote_approved = v_buyer_approved,
      supplier_quote_approved = v_supplier_approved,
      driver_quote_status = v_quote_status,
      updated_at = now()
  WHERE fl.id = p_freight_load_id
  RETURNING fl.* INTO v_load;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  SELECT DISTINCT party.user_id,
    CASE WHEN v_quote_status = 'approved' THEN 'freight_quote_approved' ELSE 'freight_quote_update' END,
    CASE WHEN v_quote_status = 'approved' THEN 'Acordo de transporte fechado' ELSE 'Actualização da negociação de transporte' END,
    v_message,
    jsonb_build_object(
      'pre_order_id', v_load.pre_order_id,
      'freight_load_id', v_load.id,
      'driver_quote_status', v_quote_status,
      'path', CASE
        WHEN party.user_id = v_buyer_id THEN '/pagamento/' || v_load.pre_order_id::text
        WHEN party.user_id = v_supplier_id THEN '/perfil?tab=orders'
        ELSE '/cargas'
      END
    )
  FROM (VALUES (v_buyer_id), (v_supplier_id), (v_load.driver_id)) AS party(user_id)
  WHERE party.user_id IS NOT NULL AND party.user_id <> v_actor_id;

  RETURN QUERY SELECT v_load.id, v_load.status, v_load.driver_offered_price, v_load.driver_quote_status;
END;
$function$;

REVOKE ALL ON FUNCTION public.respond_to_freight_quote(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_freight_quote(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_marketplace_checkout_summary(p_pre_order_id uuid)
RETURNS TABLE(
  pre_order_id uuid, product_total numeric, freight_total numeric, total numeric,
  currency text, payment_ready boolean, reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_order public.pre_orders%rowtype;
  v_load public.freight_loads%rowtype;
  v_freight numeric := 0;
  v_provider_ready boolean := false;
  v_recipient_ready boolean := false;
BEGIN
  SELECT * INTO v_order
  FROM public.pre_orders AS po
  WHERE po.id = p_pre_order_id AND po.user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_order.status <> 'accepted' THEN
    RETURN QUERY SELECT v_order.id, v_order.total_price, 0::numeric, v_order.total_price,
      'AOA'::text, false, 'WAITING_SELLER_ACCEPTANCE'::text;
    RETURN;
  END IF;
  IF coalesce(v_order.payment_status, 'unpaid') <> 'unpaid' THEN
    RETURN QUERY SELECT v_order.id, v_order.total_price, 0::numeric, v_order.total_price,
      'AOA'::text, false, 'ORDER_PAYMENT_NOT_UNPAID'::text;
    RETURN;
  END IF;

  SELECT fl.* INTO v_load
  FROM public.freight_loads AS fl
  WHERE fl.pre_order_id = v_order.id
  ORDER BY fl.created_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT v_order.id, v_order.total_price, 0::numeric, v_order.total_price,
      'AOA'::text, false, 'WAITING_FREIGHT_QUOTE'::text;
    RETURN;
  END IF;
  IF v_load.driver_quote_status IS DISTINCT FROM 'approved'
    OR v_load.buyer_quote_approved IS DISTINCT FROM true
    OR v_load.supplier_quote_approved IS DISTINCT FROM true THEN
    RETURN QUERY SELECT v_order.id, v_order.total_price, 0::numeric, v_order.total_price,
      'AOA'::text, false, 'WAITING_FREIGHT_NEGOTIATION'::text;
    RETURN;
  END IF;

  v_freight := coalesce(v_load.driver_offered_price, 0);
  IF v_freight <= 0 THEN
    RETURN QUERY SELECT v_order.id, v_order.total_price, 0::numeric, v_order.total_price,
      'AOA'::text, false, 'INVALID_FREIGHT_PRICE'::text;
    RETURN;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.payment_providers AS pp
    WHERE pp.enabled = true AND coalesce(pp.test_mode, false) = false
  ) INTO v_provider_ready;
  SELECT EXISTS(
    SELECT 1 FROM public.payment_authorized_recipients AS r
    WHERE r.active = true AND r.verified_at IS NOT NULL
      AND (r.max_amount IS NULL OR r.max_amount >= v_order.total_price + v_freight)
  ) INTO v_recipient_ready;

  RETURN QUERY SELECT v_order.id, v_order.total_price, v_freight,
    v_order.total_price + v_freight, 'AOA'::text,
    (v_provider_ready OR v_recipient_ready),
    CASE WHEN NOT v_provider_ready AND NOT v_recipient_ready THEN 'WAITING_PAYMENT_PROVIDER' ELSE 'READY' END;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_marketplace_checkout_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_marketplace_checkout_summary(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_marketplace_payment_recipients(p_pre_order_id uuid)
RETURNS TABLE(
  id uuid, display_name text, channel text, account_identifier text,
  account_holder text, instructions text, currency text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_order public.pre_orders%rowtype;
  v_load public.freight_loads%rowtype;
  v_total numeric;
BEGIN
  SELECT * INTO v_order FROM public.pre_orders AS po
  WHERE po.id = p_pre_order_id AND po.user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_order.status <> 'accepted' OR coalesce(v_order.payment_status, 'unpaid') <> 'unpaid' THEN RETURN; END IF;
  SELECT fl.* INTO v_load FROM public.freight_loads AS fl
  WHERE fl.pre_order_id = v_order.id ORDER BY fl.created_at DESC LIMIT 1;
  IF NOT FOUND OR v_load.driver_quote_status IS DISTINCT FROM 'approved'
    OR v_load.buyer_quote_approved IS DISTINCT FROM true
    OR v_load.supplier_quote_approved IS DISTINCT FROM true
    OR v_load.driver_offered_price IS NULL OR v_load.driver_offered_price <= 0 THEN
    RETURN;
  END IF;
  v_total := v_order.total_price + v_load.driver_offered_price;
  RETURN QUERY SELECT r.id, r.display_name, r.channel, r.account_identifier,
    r.account_holder, r.instructions, r.currency
  FROM public.payment_authorized_recipients AS r
  WHERE r.active = true AND r.verified_at IS NOT NULL
    AND (r.max_amount IS NULL OR r.max_amount >= v_total)
  ORDER BY r.display_name;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_marketplace_payment_recipients(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_marketplace_payment_recipients(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_order_payment_until_freight_agreed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_should_check boolean := TG_OP = 'INSERT';
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_should_check := NEW.purpose IS DISTINCT FROM OLD.purpose
      OR NEW.pre_order_id IS DISTINCT FROM OLD.pre_order_id
      OR (NEW.status IN ('created', 'pending', 'processing', 'succeeded')
        AND NEW.status IS DISTINCT FROM OLD.status);
  END IF;

  IF NEW.purpose IN ('order_payment', 'p2p_payment') AND NEW.pre_order_id IS NOT NULL AND v_should_check THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.pre_orders AS po
      JOIN public.freight_loads AS fl ON fl.pre_order_id = po.id
      WHERE po.id = NEW.pre_order_id
        AND po.status = 'accepted'
        AND coalesce(po.payment_status, 'unpaid') = 'unpaid'
        AND fl.driver_quote_status = 'approved'
        AND fl.buyer_quote_approved IS TRUE
        AND fl.supplier_quote_approved IS TRUE
        AND fl.driver_offered_price > 0
    ) THEN
      RAISE EXCEPTION 'FREIGHT_NEGOTIATION_NOT_CLOSED' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_order_payment_until_freight_agreed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_order_payment_until_freight_agreed ON public.payment_intents;
CREATE TRIGGER trg_guard_order_payment_until_freight_agreed
  BEFORE INSERT OR UPDATE OF purpose, pre_order_id, status ON public.payment_intents
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_order_payment_until_freight_agreed();