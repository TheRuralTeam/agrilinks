-- Fix participant assignment when a freight load is created for a marketplace pre-order.
-- public.pre_orders uses user_id for the buyer; buyer_id exists on public.freight_loads.
CREATE OR REPLACE FUNCTION public.set_freight_load_order_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  order_buyer uuid;
  order_supplier uuid;
BEGIN
  IF NEW.pre_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT po.user_id, p.user_id
  INTO order_buyer, order_supplier
  FROM public.pre_orders AS po
  JOIN public.products AS p ON p.id = po.product_id
  WHERE po.id = NEW.pre_order_id;

  IF order_buyer IS NULL OR order_supplier IS NULL THEN
    RAISE EXCEPTION 'The linked pre-order must have a buyer and a product supplier';
  END IF;

  NEW.buyer_id := order_buyer;
  NEW.supplier_id := order_supplier;
  RETURN NEW;
END;
$function$;
