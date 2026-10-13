-- Remove a validade temporal das pré-compras do marketplace.
-- A pré-compra permanece pendente até resposta do fornecedor/admin ou cancelamento.
-- A reserva de stock continua a ser validada nas operações de aceitação.

CREATE OR REPLACE FUNCTION public.clear_pre_order_expiration_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.reservation_expires_at := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pre_order_no_expiration ON public.pre_orders;
CREATE TRIGGER trg_pre_order_no_expiration
BEFORE INSERT ON public.pre_orders
FOR EACH ROW
EXECUTE FUNCTION public.clear_pre_order_expiration_on_insert();

REVOKE ALL ON FUNCTION public.clear_pre_order_expiration_on_insert() FROM PUBLIC, anon, authenticated;

-- Remove os prazos das pré-compras pendentes já existentes.
UPDATE public.pre_orders
SET reservation_expires_at = NULL
WHERE status IN ('pending', 'aguardando')
  AND deleted_at IS NULL;

-- A rotina de resposta do fornecedor deixa de rejeitar uma pré-compra com base no relógio.
CREATE OR REPLACE FUNCTION public.respond_to_pre_order(p_order_id uuid, p_status text)
RETURNS TABLE(id uuid, status text, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_order public.pre_orders%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_previous_status text;
  v_total numeric;
  v_available numeric;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF p_order_id IS NULL OR p_status NOT IN ('accepted','rejected') THEN
    RAISE EXCEPTION 'Invalid producer response' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_order FROM public.pre_orders AS po WHERE po.id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pre-order not found' USING ERRCODE='P0002'; END IF;

  SELECT * INTO v_product FROM public.products AS p WHERE p.id=v_order.product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found' USING ERRCODE='P0002'; END IF;
  IF v_product.user_id IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'Only the product owner can respond to this pre-order' USING ERRCODE='42501';
  END IF;
  IF v_order.status NOT IN ('pending','aguardando') THEN
    RAISE EXCEPTION 'Only pending pre-orders can receive a producer response' USING ERRCODE='22023';
  END IF;
  IF v_order.payment_status IS DISTINCT FROM 'unpaid' THEN
    RAISE EXCEPTION 'PRE_ORDER_PAYMENT_STATE_INVALID' USING ERRCODE='22023';
  END IF;

  IF p_status='accepted' THEN
    IF v_order.stock_reserved THEN
      IF coalesce(v_product.reserved_quantity, 0) < v_order.quantity THEN
        RAISE EXCEPTION 'PRE_ORDER_RESERVATION_INCONSISTENT' USING ERRCODE='22023';
      END IF;
    ELSE
      v_available := coalesce(v_product.quantity, 0) - coalesce(v_product.reserved_quantity, 0);
      IF v_available < v_order.quantity THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: stock disponível insuficiente para aceitar a pré-compra' USING ERRCODE='22023';
      END IF;
      UPDATE public.products
      SET reserved_quantity = coalesce(reserved_quantity, 0) + v_order.quantity,
          updated_at = now()
      WHERE products.id = v_product.id;
    END IF;
    IF v_product.price IS NULL OR v_product.price < 0 THEN
      RAISE EXCEPTION 'PRODUCT_PRICE_UNAVAILABLE' USING ERRCODE='22023';
    END IF;
    v_total := v_order.quantity * v_product.price;
  END IF;

  v_previous_status := v_order.status;
  UPDATE public.pre_orders AS po
  SET status=p_status,
      stock_reserved=CASE WHEN p_status='accepted' THEN true ELSE po.stock_reserved END,
      unit_price=CASE WHEN p_status='accepted' THEN v_product.price ELSE po.unit_price END,
      total_price=CASE WHEN p_status='accepted' THEN v_total ELSE po.total_price END,
      updated_at=now()
  WHERE po.id=p_order_id
  RETURNING * INTO v_order;

  INSERT INTO public.audit_logs(event_type,action,user_id,details)
  VALUES('PRE_ORDER_STATUS_CHANGED','PRODUCER_PRE_ORDER_RESPONDED',v_actor_id,
    jsonb_build_object('pre_order_id',p_order_id,'previous_status',v_previous_status,'new_status',p_status,
      'unit_price',v_order.unit_price,'total_price',v_order.total_price));

  RETURN QUERY SELECT v_order.id,v_order.status::text,coalesce(v_order.updated_at,now());
END;
$function$;

-- Mantém a mesma regra para acções administrativas, sem validade temporal.
CREATE OR REPLACE FUNCTION public.admin_update_pre_order_status(p_order_id uuid, p_status text)
RETURNS TABLE(id uuid, status text, updated_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_order public.pre_orders%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_total numeric;
  v_available numeric;
BEGIN
  IF v_actor_id IS NULL OR NOT (
    public.has_admin_permission(v_actor_id,'manage_orders'::public.admin_permission)
    OR public.is_support_agent(v_actor_id)
  ) THEN
    RAISE EXCEPTION 'Permission denied to manage orders' USING ERRCODE='42501';
  END IF;
  IF p_status NOT IN ('accepted','rejected') THEN
    RAISE EXCEPTION 'Invalid administrative status' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_order FROM public.pre_orders AS po WHERE po.id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pre-order not found' USING ERRCODE='P0002'; END IF;
  IF v_order.status NOT IN ('pending','aguardando') THEN
    RAISE EXCEPTION 'Only pending pre-orders can be changed by administration' USING ERRCODE='22023';
  END IF;
  IF v_order.payment_status IS DISTINCT FROM 'unpaid' THEN
    RAISE EXCEPTION 'PRE_ORDER_PAYMENT_STATE_INVALID' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_product FROM public.products AS p WHERE p.id=v_order.product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found' USING ERRCODE='P0002'; END IF;

  IF p_status='accepted' THEN
    IF v_order.stock_reserved THEN
      IF coalesce(v_product.reserved_quantity, 0) < v_order.quantity THEN
        RAISE EXCEPTION 'PRE_ORDER_RESERVATION_INCONSISTENT' USING ERRCODE='22023';
      END IF;
    ELSE
      v_available := coalesce(v_product.quantity, 0) - coalesce(v_product.reserved_quantity, 0);
      IF v_available < v_order.quantity THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: stock disponível insuficiente para aceitar a pré-compra' USING ERRCODE='22023';
      END IF;
      UPDATE public.products
      SET reserved_quantity = coalesce(reserved_quantity, 0) + v_order.quantity,
          updated_at = now()
      WHERE products.id = v_product.id;
    END IF;
    IF v_product.price IS NULL OR v_product.price < 0 THEN
      RAISE EXCEPTION 'PRODUCT_PRICE_UNAVAILABLE' USING ERRCODE='22023';
    END IF;
    v_total := v_order.quantity * v_product.price;
  END IF;

  UPDATE public.pre_orders AS po
  SET status=p_status,
      stock_reserved=CASE WHEN p_status='accepted' THEN true ELSE po.stock_reserved END,
      unit_price=CASE WHEN p_status='accepted' THEN v_product.price ELSE po.unit_price END,
      total_price=CASE WHEN p_status='accepted' THEN v_total ELSE po.total_price END,
      updated_at=now()
  WHERE po.id=p_order_id
  RETURNING * INTO v_order;

  INSERT INTO public.audit_logs(event_type,action,user_id,details)
  VALUES('PRE_ORDER_STATUS_CHANGED','ADMIN_PRE_ORDER_STATUS_CHANGED',v_actor_id,
    jsonb_build_object('pre_order_id',p_order_id,'new_status',p_status,
      'unit_price',v_order.unit_price,'total_price',v_order.total_price));

  RETURN QUERY SELECT v_order.id,v_order.status::text,coalesce(v_order.updated_at,now());
END;
$function$;

-- Desactiva a expiração automática. O stock reservado é libertado por aceitação,
-- rejeição ou cancelamento, e não pelo decurso de um prazo.
CREATE OR REPLACE FUNCTION public.expire_marketplace_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN 0;
END;
$function$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron')
     AND to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT cron.unschedule(jobid)
      FROM cron.job
      WHERE jobname = 'agrilink-expire-marketplace-reservations'
    $sql$;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Não foi possível remover o agendamento antigo de expiração: %', SQLERRM;
END;
$$;
