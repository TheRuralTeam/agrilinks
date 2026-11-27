ALTER TABLE public.email_outbox
  ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS email_outbox_dispatch_idx
  ON public.email_outbox (priority DESC, scheduled_at, created_at)
  WHERE status IN ('pending', 'processing');

CREATE OR REPLACE FUNCTION public.enqueue_pre_order_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_id uuid;
  v_recipient_email text;
  v_recipient_name text;
  v_product_name text;
  v_subject text;
  v_message text;
  v_event text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'pending';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_event := NEW.status;
  ELSE
    RETURN NEW;
  END IF;

  IF v_event = 'pending' THEN
    SELECT p.user_id, p.product_type INTO v_recipient_id, v_product_name
    FROM public.products p WHERE p.id = NEW.product_id;
    v_subject := 'Nova pré-compra na AgriLink';
    v_message := format('Recebeu uma nova pré-compra de %s kg para o produto %s.', NEW.quantity, COALESCE(v_product_name, 'seu produto'));
  ELSIF v_event IN ('accepted', 'rejected', 'completed') THEN
    v_recipient_id := NEW.user_id;
    SELECT p.product_type INTO v_product_name FROM public.products p WHERE p.id = NEW.product_id;
    v_subject := CASE v_event
      WHEN 'accepted' THEN 'Pré-compra aceite'
      WHEN 'rejected' THEN 'Pré-compra rejeitada'
      ELSE 'Pré-compra concluída'
    END;
    v_message := format('A sua pré-compra de %s para %s foi marcada como %s.', NEW.quantity, COALESCE(v_product_name, 'o produto'), v_event);
  ELSE
    RETURN NEW;
  END IF;

  SELECT email, full_name INTO v_recipient_email, v_recipient_name
  FROM public.users WHERE id = v_recipient_id;

  IF v_recipient_email IS NULL OR btrim(v_recipient_email) = '' THEN RETURN NEW; END IF;

  INSERT INTO public.email_outbox (
    dedupe_key, recipient, subject, template, priority, scheduled_at, payload
  ) VALUES (
    'pre-order:' || NEW.id::text || ':' || v_event,
    lower(btrim(v_recipient_email)),
    v_subject,
    'business-event',
    CASE WHEN v_event IN ('accepted', 'rejected') THEN 80 ELSE 50 END,
    now(),
    jsonb_build_object(
      'full_name', v_recipient_name,
      'title', v_subject,
      'message', v_message,
      'event', v_event,
      'pre_order_id', NEW.id,
      'product_id', NEW.product_id
    )
  ) ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_pre_order_created ON public.pre_orders;
CREATE TRIGGER email_pre_order_created
AFTER INSERT ON public.pre_orders
FOR EACH ROW EXECUTE FUNCTION public.enqueue_pre_order_email();

DROP TRIGGER IF EXISTS email_pre_order_status_changed ON public.pre_orders;
CREATE TRIGGER email_pre_order_status_changed
AFTER UPDATE OF status ON public.pre_orders
FOR EACH ROW EXECUTE FUNCTION public.enqueue_pre_order_email();

CREATE OR REPLACE FUNCTION public.claim_email_outbox(p_limit integer DEFAULT 25)
RETURNS SETOF public.email_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id
    FROM public.email_outbox
    WHERE (status = 'pending' AND scheduled_at <= now())
       OR (status = 'processing' AND locked_at < now() - interval '2 minutes')
    ORDER BY priority DESC, scheduled_at, created_at
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(p_limit, 100))
  )
  UPDATE public.email_outbox e
  SET status = 'processing', locked_at = now(), attempts = attempts + 1, updated_at = now()
  FROM claimed WHERE e.id = claimed.id RETURNING e.*;
END;
$$;