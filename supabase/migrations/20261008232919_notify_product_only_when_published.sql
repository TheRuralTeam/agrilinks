-- Evita informar que um produto foi publicado quando ainda aguarda aprovação.
CREATE OR REPLACE FUNCTION public.notify_product_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  PERFORM public.create_notification(
    NEW.user_id,
    'product',
    'Produto Publicado',
    'O seu produto "' || NEW.product_type || '" foi publicado com sucesso!',
    jsonb_build_object('product_id', NEW.id, 'product_type', NEW.product_type)
  );

  PERFORM public.create_admin_notifications(
    'product',
    'Produto Publicado',
    'Produto publicado por utilizador',
    jsonb_build_object('product_id', NEW.id, 'user_id', NEW.user_id, 'product_type', NEW.product_type)
  );
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_product_created() FROM PUBLIC, anon, authenticated;
