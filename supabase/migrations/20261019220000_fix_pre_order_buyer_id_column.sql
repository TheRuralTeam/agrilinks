-- Fix the freight-load trigger: public.pre_orders identifies its buyer via user_id,
-- not buyer_id. This migration is ordered after the production hotfix migration.
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

  SELECT o.user_id, p.user_id
    INTO order_buyer, order_supplier
  FROM public.pre_orders AS o
  JOIN public.products AS p ON p.id = o.product_id
  WHERE o.id = NEW.pre_order_id;

  IF order_buyer IS NULL OR order_supplier IS NULL THEN
    RAISE EXCEPTION 'The linked order must have a buyer and a product supplier';
  END IF;

  NEW.buyer_id := order_buyer;
  NEW.supplier_id := order_supplier;
  RETURN NEW;
END;
$function$;
