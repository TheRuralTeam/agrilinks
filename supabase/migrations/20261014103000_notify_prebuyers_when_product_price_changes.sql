-- Notify every customer with a non-deleted pre-order when a product's published price changes.
-- Emails are queued in email_outbox and delivered by the existing process-email-outbox worker.
CREATE OR REPLACE FUNCTION public.enqueue_product_price_change_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user record;
  v_direction text;
  v_old_price text;
  v_new_price text;
  v_unit text;
BEGIN
  IF NEW.price IS NOT DISTINCT FROM OLD.price THEN
    RETURN NEW;
  END IF;

  v_direction := CASE WHEN NEW.price > OLD.price THEN 'subiu' ELSE 'baixou' END;
  v_old_price := to_char(OLD.price, 'FM999G999G999G990D00');
  v_new_price := to_char(NEW.price, 'FM999G999G999G990D00');
  v_unit := coalesce(nullif(NEW.sale_unit, ''), nullif(NEW.unit, ''), 'unidade');

  FOR v_user IN
    SELECT DISTINCT u.id, u.email, u.full_name
    FROM public.pre_orders po
    JOIN public.users u ON u.id = po.user_id
    WHERE po.product_id = NEW.id
      AND po.deleted_at IS NULL
      AND u.email IS NOT NULL
      AND btrim(u.email) <> ''
  LOOP
    INSERT INTO public.email_outbox (
      dedupe_key,
      recipient,
      subject,
      template,
      payload,
      priority
    )
    VALUES (
      'product-price-change:' || NEW.id::text || ':' || v_user.id::text || ':' || gen_random_uuid()::text,
      lower(btrim(v_user.email)),
      'Alteração de preço: ' || coalesce(NEW.product_type, 'produto agrícola') || ' — AgriLink',
      'notification',
      jsonb_build_object(
        'full_name', coalesce(nullif(v_user.full_name, ''), 'Cliente AgriLink'),
        'title', 'O preço de ' || coalesce(NEW.product_type, 'um produto agrícola') || ' ' || v_direction,
        'message',
          'O preço publicado deste produto foi alterado. Antes: ' || v_old_price || ' Kz/' || v_unit ||
          '. Agora: ' || v_new_price || ' Kz/' || v_unit ||
          '. Consulte os detalhes da sua pré-compra na AgriLink para confirmar as condições aplicáveis. Esta alteração do preço publicado não modifica automaticamente os valores já registados na sua pré-compra.'
      ),
      70
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enqueue_product_price_change_emails ON public.products;
CREATE TRIGGER trg_enqueue_product_price_change_emails
AFTER UPDATE OF price ON public.products
FOR EACH ROW
WHEN (OLD.price IS DISTINCT FROM NEW.price)
EXECUTE FUNCTION public.enqueue_product_price_change_emails();

REVOKE ALL ON FUNCTION public.enqueue_product_price_change_emails() FROM PUBLIC, anon, authenticated;
