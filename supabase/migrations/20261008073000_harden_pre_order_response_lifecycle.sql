-- Corrige o ciclo de resposta da pré-compra: reserva, termos comerciais e estados finais.
-- Aceitação só é permitida enquanto a reserva estiver activa.
-- O total é recalculado no servidor com o preço aceite.
-- Administração não pode reabrir ou alterar pré-compras já respondidas.

CREATE OR REPLACE FUNCTION public.respond_to_pre_order(p_order_id uuid, p_status text)
RETURNS TABLE(id uuid, status text, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public'
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_order public.pre_orders%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_previous_status text;
  v_total numeric;
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
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

  IF p_status='accepted' THEN
    IF NOT v_order.stock_reserved THEN
      RAISE EXCEPTION 'PRE_ORDER_RESERVATION_MISSING: A reserva desta pré-compra já não está activa' USING ERRCODE='22023';
    END IF;
    IF v_order.reservation_expires_at IS NULL OR v_order.reservation_expires_at <= now() THEN
      UPDATE public.pre_orders SET status='expired',updated_at=now() WHERE id=p_order_id;
      RETURN QUERY SELECT v_order.id,'expired'::text,now();
      RETURN;
    END IF;
    IF v_product.price IS NULL OR v_product.price < 0 THEN
      RAISE EXCEPTION 'PRODUCT_PRICE_UNAVAILABLE' USING ERRCODE='22023';
    END IF;
    v_total:=v_order.quantity*v_product.price;
  END IF;

  v_previous_status:=v_order.status;
  UPDATE public.pre_orders AS po
  SET status=p_status,
      unit_price=CASE WHEN p_status='accepted' THEN v_product.price ELSE po.unit_price END,
      total_price=CASE WHEN p_status='accepted' THEN v_total ELSE po.total_price END,
      updated_at=now()
  WHERE po.id=p_order_id
  RETURNING * INTO v_order;

  INSERT INTO public.audit_logs(event_type,action,user_id,details)
  VALUES('PRE_ORDER_STATUS_CHANGED','PRODUCER_PRE_ORDER_RESPONDED',v_actor_id,
    jsonb_build_object('pre_order_id',p_order_id,'previous_status',v_previous_status,'new_status',p_status,'unit_price',v_order.unit_price,'total_price',v_order.total_price));

  RETURN QUERY SELECT v_order.id,v_order.status::text,coalesce(v_order.updated_at,now());
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_pre_order_status(p_order_id uuid,p_status text)
RETURNS TABLE(id uuid,status text,updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='public'
AS $$
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
  IF v_order.status NOT IN ('pending','aguardando') THEN
    RAISE EXCEPTION 'Only pending pre-orders can be changed by administration' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_product FROM public.products AS p WHERE p.id=v_order.product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found' USING ERRCODE='P0002'; END IF;

  IF p_status='accepted' THEN
    IF NOT v_order.stock_reserved THEN RAISE EXCEPTION 'PRE_ORDER_RESERVATION_MISSING' USING ERRCODE='22023'; END IF;
    IF v_order.reservation_expires_at IS NULL OR v_order.reservation_expires_at <= now() THEN
      UPDATE public.pre_orders SET status='expired',updated_at=now() WHERE id=p_order_id;
      RETURN QUERY SELECT p_order_id,'expired'::text,now();
      RETURN;
    END IF;
    IF v_product.price IS NULL OR v_product.price < 0 THEN RAISE EXCEPTION 'PRODUCT_PRICE_UNAVAILABLE' USING ERRCODE='22023'; END IF;
    v_total:=v_order.quantity*v_product.price;
  END IF;

  UPDATE public.pre_orders AS po
  SET status=p_status,
      unit_price=CASE WHEN p_status='accepted' THEN v_product.price ELSE po.unit_price END,
      total_price=CASE WHEN p_status='accepted' THEN v_total ELSE po.total_price END,
      updated_at=now()
  WHERE po.id=p_order_id
  RETURNING * INTO v_order;

  INSERT INTO public.audit_logs(event_type,action,user_id,details)
  VALUES('PRE_ORDER_STATUS_CHANGED','ADMIN_PRE_ORDER_STATUS_CHANGED',v_actor_id,
    jsonb_build_object('pre_order_id',p_order_id,'new_status',p_status,'unit_price',v_order.unit_price,'total_price',v_order.total_price));

  RETURN QUERY SELECT v_order.id,v_order.status::text,coalesce(v_order.updated_at,now());
END;
$$;

CREATE OR REPLACE FUNCTION public.release_marketplace_reservation(p_order_id uuid,p_expired boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $
DECLARE v_order public.pre_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.pre_orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT v_order.stock_reserved THEN RETURN; END IF;
  UPDATE public.products
  SET quantity=quantity+v_order.quantity,
      reserved_quantity=greatest(coalesce(reserved_quantity,0)-v_order.quantity,0),
      status=CASE WHEN status='removed' AND quantity+v_order.quantity>0 THEN 'active' ELSE status END,
      updated_at=now()
  WHERE id=v_order.product_id;
  UPDATE public.pre_orders
  SET stock_reserved=false,reservation_expires_at=NULL,
      status=case when p_expired then 'expired' else status end,updated_at=now()
  WHERE id=p_order_id;
END;
$;

CREATE OR REPLACE FUNCTION public.consume_marketplace_reservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $
BEGIN
  IF NEW.status IN ('accepted','completed') AND OLD.status NOT IN ('accepted','completed') AND NEW.stock_reserved THEN
    UPDATE public.products
    SET reserved_quantity=greatest(coalesce(reserved_quantity,0)-NEW.quantity,0),updated_at=now()
    WHERE id=NEW.product_id AND coalesce(reserved_quantity,0)>=NEW.quantity;
    IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_RESERVATION_COMMIT_FAILED'; END IF;
    NEW.stock_reserved:=false; NEW.reservation_expires_at:=NULL;
  END IF;
  RETURN NEW;
END;
$;

REVOKE ALL ON FUNCTION public.release_marketplace_reservation(uuid,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.consume_marketplace_reservation() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.notify_pre_order_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='public'
AS $$
DECLARE v_product_name text; v_title text; v_message text; v_type text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('rejected','expired','cancelled') THEN RETURN NEW; END IF;
  SELECT p.product_type INTO v_product_name FROM public.products p WHERE p.id=NEW.product_id;
  v_type:=CASE NEW.status WHEN 'rejected' THEN 'pre_order_rejected' WHEN 'expired' THEN 'pre_order_expired' ELSE 'pre_order_cancelled' END;
  v_title:=CASE NEW.status WHEN 'rejected' THEN 'Pré-compra rejeitada' WHEN 'expired' THEN 'Pré-compra expirada' ELSE 'Pré-compra cancelada' END;
  v_message:=CASE NEW.status
    WHEN 'rejected' THEN format('A sua pré-compra de %s kg de %s foi rejeitada pelo fornecedor.',NEW.quantity,coalesce(v_product_name,'produto'))
    WHEN 'expired' THEN format('A sua pré-compra de %s kg de %s expirou porque a reserva não foi aceite dentro do prazo.',NEW.quantity,coalesce(v_product_name,'produto'))
    ELSE format('A sua pré-compra de %s kg de %s foi cancelada.',NEW.quantity,coalesce(v_product_name,'produto')) END;
  IF NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.user_id=NEW.user_id AND n.type=v_type AND n.metadata->>'pre_order_id'=NEW.id::text) THEN
    PERFORM public.create_notification(NEW.user_id,v_type,v_title,v_message,jsonb_build_object('pre_order_id',NEW.id,'product_id',NEW.product_id,'status',NEW.status));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_pre_order_status_change ON public.pre_orders;
CREATE TRIGGER notify_pre_order_status_change
AFTER UPDATE OF status ON public.pre_orders
FOR EACH ROW EXECUTE FUNCTION public.notify_pre_order_status_change();

REVOKE ALL ON FUNCTION public.notify_pre_order_status_change() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.respond_to_pre_order(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_to_pre_order(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_update_pre_order_status(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_update_pre_order_status(uuid,text) TO authenticated;
