-- Fecha a escrita directa de pré-pedidos.
-- A criação passa pelo RPC create_marketplace_pre_order, que controla
-- stock, reserva, idempotência e identidade. Alterações de estado passam
-- pelos fluxos administrativos/do produtor e pelos RPCs especializados.

REVOKE INSERT, DELETE ON TABLE public.pre_orders FROM anon, authenticated;

-- Defesas adicionais: um pedido pendente não pode chegar a aceitação/rejeição
-- com um estado de pagamento diferente de unpaid.
CREATE OR REPLACE FUNCTION public.admin_update_pre_order_status(p_order_id uuid, p_status text)
RETURNS TABLE(id uuid, status text, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_id uuid:=auth.uid();
  v_order public.pre_orders%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_total numeric;
BEGIN
  IF v_actor_id IS NULL OR NOT (
    public.has_admin_permission(v_actor_id,'manage_orders'::public.admin_permission)
    OR public.is_support_agent(v_actor_id)
  ) THEN RAISE EXCEPTION 'Permission denied to manage orders' USING ERRCODE='42501'; END IF;
  IF p_status NOT IN ('accepted','rejected') THEN RAISE EXCEPTION 'Invalid administrative status' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_order FROM public.pre_orders AS po WHERE po.id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pre-order not found' USING ERRCODE='P0002'; END IF;
  IF v_order.status NOT IN ('pending','aguardando') THEN RAISE EXCEPTION 'Only pending pre-orders can be changed by administration' USING ERRCODE='22023'; END IF;
  IF v_order.payment_status IS DISTINCT FROM 'unpaid' THEN RAISE EXCEPTION 'PRE_ORDER_PAYMENT_STATE_INVALID' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_product FROM public.products AS p WHERE p.id=v_order.product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found' USING ERRCODE='P0002'; END IF;
  IF p_status='accepted' THEN
    IF NOT v_order.stock_reserved THEN RAISE EXCEPTION 'PRE_ORDER_RESERVATION_MISSING' USING ERRCODE='22023'; END IF;
    IF v_order.reservation_expires_at IS NULL OR v_order.reservation_expires_at <= now() THEN
      UPDATE public.pre_orders SET status='expired',updated_at=now() WHERE id=p_order_id;
      RETURN QUERY SELECT p_order_id,'expired'::text,now(); RETURN;
    END IF;
    IF v_product.price IS NULL OR v_product.price < 0 THEN RAISE EXCEPTION 'PRODUCT_PRICE_UNAVAILABLE' USING ERRCODE='22023'; END IF;
    v_total:=v_order.quantity*v_product.price;
  END IF;
  UPDATE public.pre_orders AS po
  SET status=p_status,
      unit_price=CASE WHEN p_status='accepted' THEN v_product.price ELSE po.unit_price END,
      total_price=CASE WHEN p_status='accepted' THEN v_total ELSE po.total_price END,
      updated_at=now()
  WHERE po.id=p_order_id RETURNING * INTO v_order;
  INSERT INTO public.audit_logs(event_type,action,user_id,details)
  VALUES('PRE_ORDER_STATUS_CHANGED','ADMIN_PRE_ORDER_STATUS_CHANGED',v_actor_id,
    jsonb_build_object('pre_order_id',p_order_id,'new_status',p_status,'unit_price',v_order.unit_price,'total_price',v_order.total_price));
  RETURN QUERY SELECT v_order.id,v_order.status::text,coalesce(v_order.updated_at,now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.respond_to_pre_order(p_order_id uuid, p_status text)
RETURNS TABLE(id uuid, status text, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_id uuid := auth.uid(); v_order public.pre_orders%ROWTYPE; v_product public.products%ROWTYPE;
  v_previous_status text; v_total numeric;
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_order_id IS NULL OR p_status NOT IN ('accepted','rejected') THEN RAISE EXCEPTION 'Invalid producer response' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_order FROM public.pre_orders AS po WHERE po.id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pre-order not found' USING ERRCODE='P0002'; END IF;
  SELECT * INTO v_product FROM public.products AS p WHERE p.id=v_order.product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found' USING ERRCODE='P0002'; END IF;
  IF v_product.user_id IS DISTINCT FROM v_actor_id THEN RAISE EXCEPTION 'Only the product owner can respond to this pre-order' USING ERRCODE='42501'; END IF;
  IF v_order.status NOT IN ('pending','aguardando') THEN RAISE EXCEPTION 'Only pending pre-orders can receive a producer response' USING ERRCODE='22023'; END IF;
  IF v_order.payment_status IS DISTINCT FROM 'unpaid' THEN RAISE EXCEPTION 'PRE_ORDER_PAYMENT_STATE_INVALID' USING ERRCODE='22023'; END IF;
  IF p_status='accepted' THEN
    IF NOT v_order.stock_reserved THEN RAISE EXCEPTION 'PRE_ORDER_RESERVATION_MISSING: A reserva desta pré-compra já não está activa' USING ERRCODE='22023'; END IF;
    IF v_order.reservation_expires_at IS NULL OR v_order.reservation_expires_at <= now() THEN
      UPDATE public.pre_orders SET status='expired',updated_at=now() WHERE id=p_order_id;
      RETURN QUERY SELECT v_order.id,'expired'::text,now(); RETURN;
    END IF;
    IF v_product.price IS NULL OR v_product.price < 0 THEN RAISE EXCEPTION 'PRODUCT_PRICE_UNAVAILABLE' USING ERRCODE='22023'; END IF;
    v_total:=v_order.quantity*v_product.price;
  END IF;
  v_previous_status:=v_order.status;
  UPDATE public.pre_orders AS po
  SET status=p_status,
      unit_price=CASE WHEN p_status='accepted' THEN v_product.price ELSE po.unit_price END,
      total_price=CASE WHEN p_status='accepted' THEN v_total ELSE po.total_price END,
      updated_at=now()
  WHERE po.id=p_order_id RETURNING * INTO v_order;
  INSERT INTO public.audit_logs(event_type,action,user_id,details)
  VALUES('PRE_ORDER_STATUS_CHANGED','PRODUCER_PRE_ORDER_RESPONDED',v_actor_id,
    jsonb_build_object('pre_order_id',p_order_id,'previous_status',v_previous_status,'new_status',p_status,'unit_price',v_order.unit_price,'total_price',v_order.total_price));
  RETURN QUERY SELECT v_order.id,v_order.status::text,coalesce(v_order.updated_at,now());
END;
$function$;
