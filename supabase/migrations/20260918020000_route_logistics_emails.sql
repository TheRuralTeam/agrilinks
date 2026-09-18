CREATE OR REPLACE FUNCTION public.enqueue_freight_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event text;
  v_subject text;
  v_message text;
  v_recipient_id uuid;
  v_email text;
  v_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := COALESCE(NEW.status, 'created');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_event := NEW.status;
  ELSE
    RETURN NEW;
  END IF;

  IF v_event NOT IN ('accepted', 'available', 'in_transit', 'delivered', 'completed') THEN
    RETURN NEW;
  END IF;

  v_subject := CASE v_event
    WHEN 'accepted' THEN 'Transportador confirmado para a carga'
    WHEN 'available' THEN 'Carga disponível para transporte'
    WHEN 'in_transit' THEN 'Produto em transporte'
    WHEN 'delivered' THEN 'Produto entregue com sucesso'
    ELSE 'Transporte concluído'
  END;
  v_message := CASE v_event
    WHEN 'accepted' THEN format('A carga %s foi aceite por um transportador.', NEW.product_name)
    WHEN 'available' THEN format('A carga %s está disponível para transporte.', NEW.product_name)
    WHEN 'in_transit' THEN format('A carga %s está em trânsito para %s.', NEW.product_name, NEW.destination_label)
    WHEN 'delivered' THEN format('A carga %s foi entregue com sucesso.', NEW.product_name)
    ELSE format('O transporte da carga %s foi concluído.', NEW.product_name)
  END;

  FOREACH v_recipient_id IN ARRAY ARRAY[NEW.created_by, NEW.driver_id]
  LOOP
    IF v_recipient_id IS NULL THEN CONTINUE; END IF;
    SELECT email, full_name INTO v_email, v_name FROM public.users WHERE id = v_recipient_id;
    IF v_email IS NULL OR btrim(v_email) = '' THEN CONTINUE; END IF;
    INSERT INTO public.email_outbox (dedupe_key, recipient, subject, template, priority, payload)
    VALUES (
      'freight:' || NEW.id::text || ':' || v_event || ':' || v_recipient_id::text,
      lower(btrim(v_email)), v_subject, 'business-event', 70,
      jsonb_build_object('full_name', v_name, 'title', v_subject, 'message', v_message, 'freight_load_id', NEW.id, 'event', v_event)
    ) ON CONFLICT (dedupe_key) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_freight_status_changed ON public.freight_loads;
CREATE TRIGGER email_freight_status_changed
AFTER INSERT OR UPDATE OF status, driver_id ON public.freight_loads
FOR EACH ROW EXECUTE FUNCTION public.enqueue_freight_email();