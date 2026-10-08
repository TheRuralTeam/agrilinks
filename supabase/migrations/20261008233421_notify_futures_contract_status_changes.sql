-- Gera notificações de contratos no servidor, no mesmo commit da mudança de estado.
-- O cliente deixa de chamar RPCs internos que não estão expostos a utilizadores comuns.
CREATE OR REPLACE FUNCTION public.notify_futures_contract_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_recipient uuid;
  v_event text;
  v_title text;
  v_message text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'buyer_accepted' THEN
    v_recipient := NEW.producer_id;
    v_event := 'buyer_accepted';
    v_title := 'Contrato de Futuros aceite pelo comprador';
    v_message := format(
      'O comprador aceitou o contrato de %s %s de %s. Confirme para o tornar vinculativo.',
      NEW.quantity, NEW.unit, NEW.product_name
    );
  ELSIF NEW.status = 'confirmed' THEN
    v_recipient := NEW.buyer_id;
    v_event := 'producer_confirmed';
    v_title := 'Contrato de Futuros confirmado';
    v_message := format(
      'O produtor confirmou o contrato de %s. O contrato está agora activo.',
      NEW.product_name
    );
  ELSE
    RETURN NEW;
  END IF;

  IF v_recipient IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.user_id = v_recipient
      AND n.type = 'contract'
      AND n.metadata->>'contract_id' = NEW.id::text
      AND n.metadata->>'event' = v_event
  ) THEN
    PERFORM public.create_notification(
      v_recipient,
      'contract',
      v_title,
      v_message,
      jsonb_build_object('contract_id', NEW.id, 'event', v_event)
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS notify_futures_contract_status_change ON public.futures_contracts;
CREATE TRIGGER notify_futures_contract_status_change
AFTER UPDATE OF status ON public.futures_contracts
FOR EACH ROW
EXECUTE FUNCTION public.notify_futures_contract_status_change();

REVOKE ALL ON FUNCTION public.notify_futures_contract_status_change() FROM PUBLIC, anon, authenticated;
