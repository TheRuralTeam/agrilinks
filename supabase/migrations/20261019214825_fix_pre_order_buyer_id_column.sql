-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261019214825; original ledger name: fix_pre_order_buyer_id_column.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

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
