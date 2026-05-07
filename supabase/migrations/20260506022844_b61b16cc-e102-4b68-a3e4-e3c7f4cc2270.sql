
-- Add category column
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category TEXT;

-- Change default status to pending_approval
ALTER TABLE public.products ALTER COLUMN status SET DEFAULT 'pending_approval';

-- Trigger to notify admins when a new product needs approval
CREATE OR REPLACE FUNCTION public.notify_admins_product_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending_approval' THEN
    PERFORM create_admin_notifications(
      'product_approval',
      'Produto Aguardando Aprovação',
      'Novo produto "' || NEW.product_type || '" submetido para aprovação',
      jsonb_build_object('product_id', NEW.id, 'user_id', NEW.user_id, 'product_type', NEW.product_type)
    );

    PERFORM create_notification(
      NEW.user_id,
      'product',
      'Produto em Análise',
      'Seu produto "' || NEW.product_type || '" foi recebido e aguarda aprovação dos administradores antes de aparecer no feed.',
      jsonb_build_object('product_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_product_pending ON public.products;
CREATE TRIGGER trg_notify_admins_product_pending
AFTER INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_product_pending();
