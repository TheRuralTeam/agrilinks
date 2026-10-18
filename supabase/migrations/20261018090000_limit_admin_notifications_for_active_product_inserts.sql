-- Prevent notification floods when products are bulk-inserted already active.
-- Pending products still notify moderators through notify_admins_product_pending().
-- Status transitions still notify administrators through notify_product_updated().
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

  -- Notify the product owner only. Admins are notified on pending approval
  -- and on explicit status changes; bulk imports of already-active rows must
  -- not create one admin notification per product.
  PERFORM public.create_notification(
    NEW.user_id,
    'product',
    'Produto Publicado',
    'O seu produto "' || NEW.product_type || '" foi publicado com sucesso!',
    jsonb_build_object('product_id', NEW.id, 'product_type', NEW.product_type)
  );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.notify_product_created() FROM PUBLIC, anon, authenticated;
