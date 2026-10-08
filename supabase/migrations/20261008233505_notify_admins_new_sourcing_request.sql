-- O novo pedido de sourcing gera alertas administrativos no próprio INSERT.
-- Isto evita uma RPC privilegiada chamada directamente pelo navegador.
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
    format('Comprador solicitou: %s kg de %s', NEW.quantity, NEW.product_name),
    jsonb_build_object(
      'sourcing_request_id', NEW.id,
      'user_id', NEW.user_id,
      'product_name', NEW.product_name,
      'quantity', NEW.quantity,
      'delivery_date', NEW.delivery_date
    )
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS notify_admins_new_sourcing_request ON public.sourcing_requests;
CREATE TRIGGER notify_admins_new_sourcing_request
AFTER INSERT ON public.sourcing_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_new_sourcing_request();

REVOKE ALL ON FUNCTION public.notify_admins_new_sourcing_request() FROM PUBLIC, anon, authenticated;
