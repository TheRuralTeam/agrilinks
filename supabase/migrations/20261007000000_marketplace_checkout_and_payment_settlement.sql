-- Smart Marketplace checkout:
-- 1) explicitly binds payment intents to a pre-order;
-- 2) calculates checkout totals server-side;
-- 3) prevents wallet top-up logic from crediting order payments;
-- 4) marks the pre-order paid only after a verified provider webhook.

ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS pre_order_id uuid REFERENCES public.pre_orders(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_intents_pre_order_active
  ON public.payment_intents(pre_order_id)
  WHERE pre_order_id IS NOT NULL
    AND status IN ('created','pending','processing');

CREATE INDEX IF NOT EXISTS idx_payment_intents_pre_order
  ON public.payment_intents(pre_order_id);

CREATE OR REPLACE FUNCTION public.get_marketplace_checkout_summary(p_pre_order_id uuid)
RETURNS TABLE(
  pre_order_id uuid,
  product_total numeric,
  freight_total numeric,
  total numeric,
  currency text,
  payment_ready boolean,
  reason text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_order public.pre_orders%ROWTYPE;
  v_freight numeric := 0;
BEGIN
  SELECT * INTO v_order
  FROM public.pre_orders
  WHERE id=p_pre_order_id AND user_id=auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE='P0002';
  END IF;

  IF v_order.status <> 'accepted' THEN
    RETURN QUERY SELECT v_order.id,v_order.total_price,0::numeric,v_order.total_price,
      'AOA'::text,false,'WAITING_SELLER_ACCEPTANCE'::text;
    RETURN;
  END IF;

  SELECT COALESCE(fl.offered_price,fl.driver_offered_price,0)
  INTO v_freight
  FROM public.freight_loads fl
  WHERE fl.pre_order_id=v_order.id
  ORDER BY fl.created_at DESC LIMIT 1;

  RETURN QUERY SELECT v_order.id,v_order.total_price,v_freight,v_order.total_price+v_freight,
    'AOA'::text,(v_freight>0),
    CASE WHEN v_freight>0 THEN 'READY' ELSE 'WAITING_FREIGHT_QUOTE' END;
END;
$$;

REVOKE ALL ON FUNCTION public.get_marketplace_checkout_summary(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_marketplace_checkout_summary(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_wallet_payment_webhook(
  p_provider_id text,p_provider_event_id text,p_event_type text,p_body_sha256 text,
  p_provider_reference text,p_provider_status text,p_amount numeric,p_currency character
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_event_id uuid;
  v_existing_body_sha256 text;
  v_existing_outcome text;
  v_intent public.payment_intents%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE='42501';
  END IF;

  INSERT INTO public.payment_webhook_events(provider_id,provider_event_id,event_type,body_sha256)
  VALUES(p_provider_id,p_provider_event_id,p_event_type,p_body_sha256)
  ON CONFLICT(provider_id,provider_event_id) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    SELECT id,body_sha256,outcome INTO v_event_id,v_existing_body_sha256,v_existing_outcome
    FROM public.payment_webhook_events
    WHERE provider_id=p_provider_id AND provider_event_id=p_provider_event_id FOR UPDATE;
    IF NOT FOUND THEN RETURN 'retry'; END IF;
    IF v_existing_body_sha256<>p_body_sha256 THEN RETURN 'duplicate_payload_mismatch'; END IF;
    IF v_existing_outcome IN ('processed','ignored') THEN RETURN 'duplicate'; END IF;
    IF v_existing_outcome='rejected' THEN RETURN 'rejected'; END IF;
  END IF;

  SELECT * INTO v_intent FROM public.payment_intents
  WHERE provider_id=p_provider_id AND provider_reference=p_provider_reference FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE public.payment_webhook_events SET outcome='received',error_code='payment_not_found',processed_at=NULL WHERE id=v_event_id;
    RETURN 'retry';
  END IF;

  UPDATE public.payment_webhook_events SET payment_intent_id=v_intent.id WHERE id=v_event_id;

  IF v_intent.amount<>p_amount OR v_intent.currency<>p_currency THEN
    UPDATE public.payment_webhook_events SET outcome='rejected',error_code='amount_or_currency_mismatch',processed_at=now() WHERE id=v_event_id;
    RETURN 'rejected';
  END IF;

  IF v_intent.status IN ('succeeded','refunded') THEN
    UPDATE public.payment_webhook_events SET outcome='ignored',error_code='payment_already_terminal',processed_at=now() WHERE id=v_event_id;
    RETURN 'ignored';
  END IF;

  IF p_provider_status='succeeded' THEN
    UPDATE public.payment_intents SET status='succeeded',updated_at=now(),completed_at=now() WHERE id=v_intent.id;

    IF v_intent.purpose='order_payment' THEN
      IF v_intent.pre_order_id IS NULL THEN
        UPDATE public.payment_webhook_events SET outcome='rejected',error_code='missing_pre_order',processed_at=now() WHERE id=v_event_id;
        RETURN 'rejected';
      END IF;

      UPDATE public.pre_orders
      SET payment_status='paid',updated_at=now()
      WHERE id=v_intent.pre_order_id
        AND user_id=v_intent.user_id
        AND status='accepted';

      IF NOT FOUND THEN
        UPDATE public.payment_webhook_events SET outcome='rejected',error_code='order_not_payable',processed_at=now() WHERE id=v_event_id;
        RETURN 'rejected';
      END IF;
    ELSE
      INSERT INTO public.transactions(wallet_id,type,status,amount,description,reference_id,payment_intent_id,completed_at)
      VALUES(v_intent.wallet_id,'deposit','completed',v_intent.amount,'Carregamento confirmado pelo provedor de pagamento',v_intent.id,v_intent.id,now());

      UPDATE public.wallets
      SET available_balance=available_balance+v_intent.amount,total_earned=total_earned+v_intent.amount,updated_at=now()
      WHERE id=v_intent.wallet_id;
    END IF;

    UPDATE public.payment_webhook_events SET outcome='processed',processed_at=now() WHERE id=v_event_id;
    RETURN 'processed';
  END IF;

  IF v_intent.status IN ('failed','cancelled','expired') THEN
    UPDATE public.payment_webhook_events SET outcome='ignored',error_code='payment_already_terminal',processed_at=now() WHERE id=v_event_id;
    RETURN 'ignored';
  END IF;

  IF p_provider_status IN ('pending','processing') THEN
    UPDATE public.payment_intents
    SET status=CASE WHEN p_provider_status='processing' THEN 'processing' ELSE status END,updated_at=now()
    WHERE id=v_intent.id;
    UPDATE public.payment_webhook_events SET outcome='processed',processed_at=now() WHERE id=v_event_id;
    RETURN 'processed';
  END IF;

  IF p_provider_status IN ('failed','cancelled') THEN
    UPDATE public.payment_intents SET status=p_provider_status,updated_at=now() WHERE id=v_intent.id;
    UPDATE public.payment_webhook_events SET outcome='processed',processed_at=now() WHERE id=v_event_id;
    RETURN 'processed';
  END IF;

  UPDATE public.payment_webhook_events SET outcome='rejected',error_code='unsupported_status',processed_at=now() WHERE id=v_event_id;
  RETURN 'rejected';
END;
$$;
