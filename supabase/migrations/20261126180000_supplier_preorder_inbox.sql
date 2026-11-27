-- Ensure product owners can see incoming pre-orders and are notified at creation.
-- Buyers retain access to their own orders; suppliers only see orders for their products.

DROP POLICY IF EXISTS "Fornecedores podem ver pré-compras dos seus produtos" ON public.pre_orders;
CREATE POLICY "Fornecedores podem ver pré-compras dos seus produtos"
ON public.pre_orders
FOR SELECT
TO authenticated
USING (
  pre_orders.deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.products AS product
    WHERE product.id = pre_orders.product_id
      AND product.user_id = (SELECT auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.notify_supplier_of_new_pre_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_supplier_id uuid;
  v_product_name text;
  v_buyer_name text;
  v_quantity_label text;
BEGIN
  SELECT product.user_id, product.product_type
    INTO v_supplier_id, v_product_name
  FROM public.products AS product
  WHERE product.id = NEW.product_id;

  IF v_supplier_id IS NULL OR v_supplier_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(btrim(u.full_name), '')
    INTO v_buyer_name
  FROM public.users AS u
  WHERE u.id = NEW.user_id;

  v_quantity_label := to_char(NEW.quantity, 'FM999G999G999G990D00');

  IF NOT EXISTS (
    SELECT 1
    FROM public.notifications AS notification
    WHERE notification.user_id = v_supplier_id
      AND notification.type = 'pre_order_received'
      AND notification.metadata->>'pre_order_id' = NEW.id::text
  ) THEN
    PERFORM public.create_notification(
      v_supplier_id,
      'pre_order_received',
      'Nova pré-compra recebida',
      format(
        '%s solicitou %s kg de %s. Abre os pedidos recebidos para aceitar ou rejeitar a pré-compra.',
        COALESCE(v_buyer_name, 'Um comprador'),
        v_quantity_label,
        COALESCE(v_product_name, 'um dos teus produtos')
      ),
      jsonb_build_object(
        'pre_order_id', NEW.id,
        'product_id', NEW.product_id,
        'buyer_id', NEW.user_id,
        'quantity', NEW.quantity,
        'status', NEW.status,
        'path', '/pedidos-fornecedor'
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_supplier_of_new_pre_order() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_supplier_of_new_pre_order ON public.pre_orders;
CREATE TRIGGER trg_notify_supplier_of_new_pre_order
AFTER INSERT ON public.pre_orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_supplier_of_new_pre_order();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'pre_orders'
     ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.pre_orders';
  END IF;
END;
$$;

-- Backfill pending requests created before this migration so they are visible
-- and actionable immediately after deployment.
DO $backfill$
DECLARE
  v_order record;
BEGIN
  FOR v_order IN
    SELECT
      po.id,
      po.product_id,
      po.user_id AS buyer_id,
      po.quantity,
      po.status,
      product.user_id AS supplier_id,
      product.product_type,
      buyer.full_name AS buyer_name
    FROM public.pre_orders AS po
    JOIN public.products AS product ON product.id = po.product_id
    LEFT JOIN public.users AS buyer ON buyer.id = po.user_id
    WHERE po.status IN ('pending', 'aguardando')
      AND po.deleted_at IS NULL
      AND product.user_id IS NOT NULL
      AND product.user_id <> po.user_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.notifications AS notification
        WHERE notification.user_id = product.user_id
          AND notification.type = 'pre_order_received'
          AND notification.metadata->>'pre_order_id' = po.id::text
      )
  LOOP
    PERFORM public.create_notification(
      v_order.supplier_id,
      'pre_order_received',
      'Pré-compra pendente',
      format(
        '%s solicitou %s kg de %s. Abre os pedidos recebidos para aceitar ou rejeitar a pré-compra.',
        COALESCE(NULLIF(btrim(v_order.buyer_name), ''), 'Um comprador'),
        to_char(v_order.quantity, 'FM999G999G999G990D00'),
        COALESCE(v_order.product_type, 'um dos teus produtos')
      ),
      jsonb_build_object(
        'pre_order_id', v_order.id,
        'product_id', v_order.product_id,
        'buyer_id', v_order.buyer_id,
        'quantity', v_order.quantity,
        'status', v_order.status,
        'path', '/pedidos-fornecedor'
      )
    );
  END LOOP;
END;
$backfill$;
