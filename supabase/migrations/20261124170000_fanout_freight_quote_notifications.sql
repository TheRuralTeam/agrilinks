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
  IF NEW.pre_order_id IS NULL OR NEW.status <> 'available' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  SELECT
    u.id,
    'freight_load',
    'Nova pré-compra para transporte',
    format(
      'O produto %s tem um pedido aceite de %s kg, de %s para %s. Abre Cargas para rever a rota e apresentar o teu preço.',
      NEW.product_name,
      to_char(NEW.weight_kg, 'FM999G999G999G990D00'),
      NEW.origin_label,
      NEW.destination_label
    ),
    jsonb_build_object(
      'pre_order_id', NEW.pre_order_id,
      'freight_load_id', NEW.id,
      'path', '/cargas'
    )
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
    SELECT p.user_id INTO v_supplier_id
    FROM public.products AS p
    WHERE p.id = NEW.product_id;
  END IF;

  IF v_supplier_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      v_supplier_id,
      'freight_quote',
      'Proposta de transporte recebida',
         format(
           'Um motorista propôs %s Kz para transportar %s kg de %s para %s. O comprador decide o preço; a comissão do fornecedor é 8%% do valor do produto após a confirmação do pagamento.',
        to_char(NEW.driver_offered_price, 'FM999G999G999G990D00'),
        to_char(NEW.weight_kg, 'FM999G999G999G990D00'),
        NEW.origin_label,
        NEW.destination_label
      ),
      jsonb_build_object(
        'pre_order_id', NEW.pre_order_id,
        'freight_load_id', NEW.id,
        'path', '/perfil?tab=orders'
      )
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