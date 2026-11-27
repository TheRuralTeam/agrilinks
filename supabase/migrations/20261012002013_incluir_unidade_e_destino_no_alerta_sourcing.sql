CREATE OR REPLACE FUNCTION public.notify_admins_new_sourcing_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM public.create_admin_notifications(
    'sourcing',
    'Novo Pedido de Sourcing',
    format('Comprador solicitou: %s %s de %s', NEW.quantity, COALESCE(NEW.unit, 'kg'), NEW.product_name),
    jsonb_build_object(
      'sourcing_request_id', NEW.id,
      'user_id', NEW.user_id,
      'product_name', NEW.product_name,
      'quantity', NEW.quantity,
      'unit', COALESCE(NEW.unit, 'kg'),
      'delivery_date', NEW.delivery_date,
      'delivery_province_id', NEW.delivery_province_id,
      'delivery_municipality_id', NEW.delivery_municipality_id,
      'delivery_location', NEW.delivery_location
    )
  );
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_admins_new_sourcing_request() FROM PUBLIC, anon, authenticated;
