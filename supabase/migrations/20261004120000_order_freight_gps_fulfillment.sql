-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261004120000; original ledger name: order_freight_gps_fulfillment.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

BEGIN;

ALTER TABLE public.pre_orders
  ADD COLUMN destination_lat DOUBLE PRECISION,
  ADD COLUMN destination_lng DOUBLE PRECISION,
  ADD CONSTRAINT pre_orders_destination_coordinates_pair
    CHECK (
      (destination_lat IS NULL AND destination_lng IS NULL)
      OR (
        destination_lat BETWEEN -90 AND 90
        AND destination_lng BETWEEN -180 AND 180
      )
    );

ALTER TABLE public.freight_loads
  ADD COLUMN pre_order_id UUID REFERENCES public.pre_orders(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX freight_loads_pre_order_id_uidx
  ON public.freight_loads (pre_order_id)
  WHERE pre_order_id IS NOT NULL;

DROP POLICY IF EXISTS "Pre-order buyers can view linked freight loads"
  ON public.freight_loads;

CREATE POLICY "Pre-order buyers can view linked freight loads"
  ON public.freight_loads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pre_orders
      WHERE public.pre_orders.id = pre_order_id
        AND public.pre_orders.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Freight parties can view latest driver location"
  ON public.freight_load_locations;

CREATE POLICY "Freight parties can view latest driver location"
  ON public.freight_load_locations
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
          OR EXISTS (
            SELECT 1
            FROM public.pre_orders
            WHERE public.pre_orders.id = load.pre_order_id
              AND public.pre_orders.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Freight parties can view location history"
  ON public.freight_load_location_history;

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
          OR EXISTS (
            SELECT 1
            FROM public.pre_orders
            WHERE public.pre_orders.id = load.pre_order_id
              AND public.pre_orders.user_id = auth.uid()
          )
        )
    )
  );

CREATE OR REPLACE FUNCTION public.validate_product_origin_coordinates()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
  IF NEW.location_lat IS NULL
    OR NEW.location_lng IS NULL
    OR NEW.location_lat NOT BETWEEN -90 AND 90
    OR NEW.location_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'A product must have a valid origin point for GPS delivery'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER require_product_origin_coordinates
BEFORE INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.validate_product_origin_coordinates();

CREATE OR REPLACE FUNCTION public.validate_pre_order_delivery_coordinates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_product public.products%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Authentication required to create a pre-order'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS NULL OR NEW.status NOT IN ('pending', 'aguardando') THEN
    RAISE EXCEPTION 'New pre-orders must start in a pending state'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.location IS NULL OR LENGTH(BTRIM(NEW.location)) < 3 THEN
    RAISE EXCEPTION 'A delivery address is required'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.destination_lat IS NULL OR NEW.destination_lng IS NULL
    OR NEW.destination_lat NOT BETWEEN -90 AND 90
    OR NEW.destination_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'A valid delivery point is required for GPS tracking'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.quantity IS NULL OR NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'The requested quantity must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_product
  FROM public.products
  WHERE id = NEW.product_id;

  IF NOT FOUND OR v_product.status <> 'active' THEN
    RAISE EXCEPTION 'Product is not available for pre-order'
      USING ERRCODE = '22023';
  END IF;

  IF v_product.user_id = NEW.user_id THEN
    RAISE EXCEPTION 'A producer cannot order their own product'
      USING ERRCODE = '22023';
  END IF;

  IF NEW.quantity > v_product.quantity THEN
    RAISE EXCEPTION 'Requested quantity exceeds available product stock'
      USING ERRCODE = '22023';
  END IF;

  IF v_product.location_lat IS NULL OR v_product.location_lng IS NULL
    OR v_product.location_lat NOT BETWEEN -90 AND 90
    OR v_product.location_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Product has no valid GPS origin point'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER require_pre_order_delivery_coordinates
BEFORE INSERT ON public.pre_orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_pre_order_delivery_coordinates();

CREATE OR REPLACE FUNCTION public.prepare_pre_order_for_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF OLD.status = 'accepted' AND EXISTS (
    SELECT 1
    FROM public.freight_loads
    WHERE pre_order_id = OLD.id
      AND status = 'in_transit'
  ) THEN
    RAISE EXCEPTION 'An order cannot be deleted while its GPS delivery is in transit'
      USING ERRCODE = '22023';
  END IF;

  IF OLD.status = 'accepted' THEN
    UPDATE public.products
    SET quantity = quantity + OLD.quantity
    WHERE id = OLD.product_id;
  END IF;

  RETURN OLD;
END;
$function$;

CREATE TRIGGER prepare_pre_order_for_deletion
BEFORE DELETE ON public.pre_orders
FOR EACH ROW
EXECUTE FUNCTION public.prepare_pre_order_for_deletion();

CREATE OR REPLACE FUNCTION public.create_freight_load_for_accepted_pre_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_product public.products%ROWTYPE;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    SELECT *
    INTO v_product
    FROM public.products
    WHERE id = NEW.product_id
    FOR SHARE;

    IF NOT FOUND
      OR v_product.location_lat IS NULL
      OR v_product.location_lng IS NULL
      OR v_product.location_lat NOT BETWEEN -90 AND 90
      OR v_product.location_lng NOT BETWEEN -180 AND 180
      OR NEW.destination_lat IS NULL
      OR NEW.destination_lng IS NULL
      OR NEW.destination_lat NOT BETWEEN -90 AND 90
      OR NEW.destination_lng NOT BETWEEN -180 AND 180 THEN
      RAISE EXCEPTION 'A complete GPS route is required before accepting this order'
        USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.freight_loads (
      created_by,
      pre_order_id,
      product_id,
      product_name,
      weight_kg,
      origin_label,
      origin_lat,
      origin_lng,
      destination_label,
      destination_lat,
      destination_lng,
      pickup_date,
      currency,
      status,
      notes
    )
    VALUES (
      v_product.user_id,
      NEW.id,
      v_product.id,
      v_product.product_type,
      NEW.quantity,
      CONCAT_WS(', ', NULLIF(v_product.municipality_id, ''), NULLIF(v_product.province_id, '')),
      v_product.location_lat,
      v_product.location_lng,
      NEW.location,
      NEW.destination_lat,
      NEW.destination_lng,
      v_product.harvest_date,
      'Kz',
      'available',
      'Carga criada automaticamente a partir de um pedido AgriLink.'
    )
    ON CONFLICT (pre_order_id) WHERE pre_order_id IS NOT NULL DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER create_freight_load_after_pre_order_acceptance
AFTER UPDATE OF status ON public.pre_orders
FOR EACH ROW
EXECUTE FUNCTION public.create_freight_load_for_accepted_pre_order();

CREATE OR REPLACE FUNCTION public.guard_pre_order_cancellation_during_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_product public.products%ROWTYPE;
BEGIN
  IF OLD.status IN ('rejected', 'cancelled', 'completed', 'concluida', 'cancelado')
    AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Final pre-orders cannot be reopened'
      USING ERRCODE = '22023';
  END IF;

  IF OLD.status = 'accepted' AND NEW.status IN ('pending', 'aguardando') THEN
    RAISE EXCEPTION 'An accepted pre-order cannot return to a pending state'
      USING ERRCODE = '22023';
  END IF;

  IF OLD.status IS DISTINCT FROM 'accepted' AND NEW.status = 'accepted' THEN
    SELECT *
    INTO v_product
    FROM public.products
    WHERE id = NEW.product_id
    FOR UPDATE;

    IF NOT FOUND OR v_product.status <> 'active' THEN
      RAISE EXCEPTION 'Product is no longer available'
        USING ERRCODE = '22023';
    END IF;

    IF NEW.quantity > v_product.quantity THEN
      RAISE EXCEPTION 'Requested quantity exceeds remaining product stock'
        USING ERRCODE = '22023';
    END IF;

    UPDATE public.products
    SET quantity = quantity - NEW.quantity
    WHERE id = NEW.product_id;
  END IF;

  IF OLD.status = 'accepted' AND NEW.status IN ('cancelled', 'rejected')
    AND EXISTS (
      SELECT 1
      FROM public.freight_loads
      WHERE pre_order_id = OLD.id
        AND status IN ('in_transit', 'delivered')
    ) THEN
    RAISE EXCEPTION 'An order cannot be cancelled after GPS transport has started'
      USING ERRCODE = '22023';
  END IF;

  IF OLD.status = 'accepted' AND NEW.status IN ('cancelled', 'rejected') THEN
    UPDATE public.products
    SET quantity = quantity + OLD.quantity
    WHERE id = OLD.product_id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER guard_pre_order_cancellation_during_delivery
BEFORE UPDATE OF status ON public.pre_orders
FOR EACH ROW
EXECUTE FUNCTION public.guard_pre_order_cancellation_during_delivery();

CREATE OR REPLACE FUNCTION public.cancel_freight_load_for_cancelled_pre_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF OLD.status = 'accepted' AND NEW.status IN ('cancelled', 'rejected') THEN
    UPDATE public.freight_loads
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE pre_order_id = NEW.id
      AND status NOT IN ('cancelled', 'delivered');
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER cancel_freight_load_after_pre_order_cancellation
AFTER UPDATE OF status ON public.pre_orders
FOR EACH ROW
EXECUTE FUNCTION public.cancel_freight_load_for_cancelled_pre_order();

CREATE OR REPLACE FUNCTION public.sync_pre_order_with_freight_load()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status = OLD.status OR NEW.pre_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'delivered' THEN
    UPDATE public.pre_orders
    SET status = 'completed',
        updated_at = NOW()
    WHERE id = NEW.pre_order_id
      AND status = 'accepted';

    IF FOUND THEN
      INSERT INTO public.audit_logs (event_type, action, user_id, details)
      VALUES (
        'PRE_ORDER_STATUS_CHANGED',
        'FREIGHT_LOAD_DELIVERED',
        COALESCE(NEW.driver_id, auth.uid()),
        jsonb_build_object(
          'pre_order_id', NEW.pre_order_id,
          'freight_load_id', NEW.id,
          'new_status', 'completed'
        )
      );
    END IF;
  ELSIF NEW.status = 'cancelled' THEN
    UPDATE public.pre_orders
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = NEW.pre_order_id
      AND status = 'accepted';

    IF FOUND THEN
      INSERT INTO public.audit_logs (event_type, action, user_id, details)
      VALUES (
        'PRE_ORDER_STATUS_CHANGED',
        'FREIGHT_LOAD_CANCELLED',
        COALESCE(NEW.driver_id, auth.uid()),
        jsonb_build_object(
          'pre_order_id', NEW.pre_order_id,
          'freight_load_id', NEW.id,
          'new_status', 'cancelled'
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER sync_pre_order_after_freight_load_status
AFTER UPDATE OF status ON public.freight_loads
FOR EACH ROW
EXECUTE FUNCTION public.sync_pre_order_with_freight_load();

CREATE OR REPLACE FUNCTION public.accept_freight_load(p_freight_load_id UUID)
RETURNS TABLE (
  id UUID,
  status TEXT,
  driver_id UUID,
  accepted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id UUID := auth.uid();
  v_user_type TEXT;
  v_capacity NUMERIC;
  v_email_verified BOOLEAN;
  v_load public.freight_loads%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT user_type::TEXT, load_capacity_kg, email_verified
  INTO v_user_type, v_capacity, v_email_verified
  FROM public.users
  WHERE id = v_actor_id;

  IF v_user_type IS DISTINCT FROM 'motorista'
    AND NOT public.has_role(v_actor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only an eligible driver can accept a freight load'
      USING ERRCODE = '42501';
  END IF;
  IF v_email_verified IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'A verified email is required to accept a freight load'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_load
  FROM public.freight_loads
  WHERE id = p_freight_load_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Freight load not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_capacity IS NOT NULL AND v_load.weight_kg > v_capacity THEN
    RAISE EXCEPTION 'Freight load exceeds the driver capacity'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.freight_loads
  SET driver_id = v_actor_id,
      status = 'accepted',
      accepted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_freight_load_id
    AND driver_id IS NULL
    AND created_by <> v_actor_id
    AND status IN ('available', 'open', 'agendado')
  RETURNING * INTO v_load;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This freight load is no longer available'
      USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.audit_logs (event_type, action, user_id, details)
  VALUES (
    'FREIGHT_LOAD_STATUS_CHANGED',
    'DRIVER_ACCEPTED_FREIGHT_LOAD',
    v_actor_id,
    jsonb_build_object('freight_load_id', v_load.id, 'new_status', v_load.status)
  );

  RETURN QUERY SELECT v_load.id, v_load.status::TEXT, v_load.driver_id, v_load.accepted_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.advance_freight_load_status(
  p_freight_load_id UUID,
  p_status TEXT
)
RETURNS TABLE (
  id UUID,
  status TEXT,
  driver_id UUID,
  in_transit_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id UUID := auth.uid();
  v_user_type TEXT;
  v_email_verified BOOLEAN;
  v_load public.freight_loads%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('in_transit', 'delivered') THEN
    RAISE EXCEPTION 'Invalid freight load status'
      USING ERRCODE = '22023';
  END IF;

  SELECT user_type::TEXT, email_verified
  INTO v_user_type, v_email_verified
  FROM public.users
  WHERE id = v_actor_id;

  IF v_user_type IS DISTINCT FROM 'motorista'
    AND NOT public.has_role(v_actor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only an eligible driver can update a freight load'
      USING ERRCODE = '42501';
  END IF;
  IF v_email_verified IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'A verified email is required to update a freight load'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_load
  FROM public.freight_loads
  WHERE id = p_freight_load_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Freight load not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_load.driver_id IS DISTINCT FROM v_actor_id
    AND NOT public.has_role(v_actor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only the assigned driver can update this freight load'
      USING ERRCODE = '42501';
  END IF;

  IF NOT (
    (v_load.status = 'accepted' AND p_status = 'in_transit')
    OR (v_load.status = 'in_transit' AND p_status = 'delivered')
  ) THEN
    RAISE EXCEPTION 'Invalid freight load status transition'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.freight_loads
  SET status = p_status,
      in_transit_at = CASE WHEN p_status = 'in_transit' THEN NOW() ELSE in_transit_at END,
      delivered_at = CASE WHEN p_status = 'delivered' THEN NOW() ELSE delivered_at END,
      updated_at = NOW()
  WHERE id = p_freight_load_id
    AND driver_id = v_actor_id
    AND status = v_load.status
  RETURNING * INTO v_load;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Freight load status changed concurrently'
      USING ERRCODE = '40001';
  END IF;

  INSERT INTO public.audit_logs (event_type, action, user_id, details)
  VALUES (
    'FREIGHT_LOAD_STATUS_CHANGED',
    'DRIVER_ADVANCED_FREIGHT_LOAD',
    v_actor_id,
    jsonb_build_object(
      'freight_load_id', v_load.id,
      'previous_status', CASE WHEN p_status = 'in_transit' THEN 'accepted' ELSE 'in_transit' END,
      'new_status', v_load.status
    )
  );

  RETURN QUERY
  SELECT v_load.id, v_load.status::TEXT, v_load.driver_id,
    v_load.in_transit_at, v_load.delivered_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_freight_load(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.accept_freight_load(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.advance_freight_load_status(UUID, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.advance_freight_load_status(UUID, TEXT) TO authenticated;

COMMIT;
