ALTER TABLE public.commissions
  ALTER COLUMN transaction_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS pre_order_id uuid REFERENCES public.pre_orders(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS commission_role text,
  ADD COLUMN IF NOT EXISTS gross_amount numeric(15, 2),
  ADD COLUMN IF NOT EXISTS net_amount numeric(15, 2),
  ADD COLUMN IF NOT EXISTS settlement_status text NOT NULL DEFAULT 'pending_payout',
  ADD COLUMN IF NOT EXISTS settled_at timestamptz;

ALTER TABLE public.commissions DROP CONSTRAINT IF EXISTS positive_commission;
ALTER TABLE public.commissions
  DROP CONSTRAINT IF EXISTS commissions_role_check,
  DROP CONSTRAINT IF EXISTS commissions_amounts_check,
  DROP CONSTRAINT IF EXISTS commissions_settlement_status_check,
  ADD CONSTRAINT positive_commission CHECK (amount >= 0 AND percentage > 0 AND percentage <= 100),
  ADD CONSTRAINT commissions_role_check CHECK (commission_role IS NULL OR commission_role IN ('supplier', 'driver')),
  ADD CONSTRAINT commissions_amounts_check CHECK (
    (gross_amount IS NULL AND net_amount IS NULL)
    OR (gross_amount > 0 AND net_amount >= 0 AND amount <= gross_amount)
  ),
  ADD CONSTRAINT commissions_settlement_status_check CHECK (settlement_status IN ('pending_payout', 'paid'));

CREATE UNIQUE INDEX IF NOT EXISTS ux_commissions_preorder_role
  ON public.commissions(pre_order_id, commission_role)
  WHERE pre_order_id IS NOT NULL AND commission_role IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commissions_payment_intent
  ON public.commissions(payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

DROP POLICY IF EXISTS "Administrators view marketplace commissions" ON public.commissions;
CREATE POLICY "Administrators view marketplace commissions"
  ON public.commissions FOR SELECT TO authenticated
  USING (
    public.is_root_admin(auth.uid())
    OR public.has_admin_permission(auth.uid(), 'view_analytics'::public.admin_permission)
  );
GRANT SELECT ON public.commissions TO authenticated;

CREATE OR REPLACE FUNCTION public.record_marketplace_commissions_after_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_supplier_id uuid;
  v_driver_id uuid;
  v_intent_id uuid;
  v_product_gross numeric;
  v_freight_gross numeric;
  v_supplier_fee numeric;
  v_driver_fee numeric;
BEGIN
  IF NEW.payment_status IS DISTINCT FROM 'paid' OR OLD.payment_status = 'paid' THEN
    RETURN NEW;
  END IF;

  SELECT p.user_id INTO v_supplier_id
  FROM public.products AS p WHERE p.id = NEW.product_id;

  SELECT fl.driver_id, fl.driver_offered_price
  INTO v_driver_id, v_freight_gross
  FROM public.freight_loads AS fl
  WHERE fl.pre_order_id = NEW.id
    AND fl.driver_quote_status = 'approved'
    AND fl.buyer_quote_approved IS TRUE
    AND fl.driver_id IS NOT NULL
  ORDER BY fl.created_at DESC
  LIMIT 1;

  SELECT pi.id INTO v_intent_id
  FROM public.payment_intents AS pi
  WHERE pi.pre_order_id = NEW.id
    AND pi.user_id = NEW.user_id
    AND pi.purpose IN ('order_payment', 'p2p_payment')
    AND pi.status = 'succeeded'
  ORDER BY pi.completed_at DESC NULLS LAST, pi.created_at DESC
  LIMIT 1;

  v_product_gross := coalesce(NEW.total_price, NEW.unit_price * NEW.quantity);
  IF v_supplier_id IS NULL OR v_driver_id IS NULL OR v_intent_id IS NULL
    OR v_product_gross IS NULL OR v_product_gross <= 0
    OR v_freight_gross IS NULL OR v_freight_gross <= 0 THEN
    RAISE EXCEPTION 'COMMISSION_LEDGER_PREREQUISITES_MISSING' USING ERRCODE = '22023';
  END IF;

  v_supplier_fee := round(v_product_gross * 0.08, 2);
  v_driver_fee := round(v_freight_gross * 0.10, 2);

  INSERT INTO public.commissions (
    transaction_id, payment_intent_id, pre_order_id, user_id,
    amount, percentage, type, commission_role, gross_amount, net_amount, settlement_status
  ) VALUES
    (NULL, v_intent_id, NEW.id, v_supplier_id, v_supplier_fee, 8, 'sale', 'supplier',
      v_product_gross, v_product_gross - v_supplier_fee, 'pending_payout'),
    (NULL, v_intent_id, NEW.id, v_driver_id, v_driver_fee, 10, 'freight', 'driver',
      v_freight_gross, v_freight_gross - v_driver_fee, 'pending_payout')
  ON CONFLICT (pre_order_id, commission_role)
  WHERE pre_order_id IS NOT NULL AND commission_role IS NOT NULL
  DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_marketplace_commissions_after_payment() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_record_marketplace_commissions_after_payment ON public.pre_orders;
CREATE TRIGGER trg_record_marketplace_commissions_after_payment
  AFTER UPDATE OF payment_status ON public.pre_orders
  FOR EACH ROW
  WHEN (NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM NEW.payment_status)
  EXECUTE FUNCTION public.record_marketplace_commissions_after_payment();

WITH eligible AS (
  SELECT po.id AS pre_order_id, po.user_id AS buyer_id, product.user_id AS supplier_id,
    freight.driver_id, freight.driver_offered_price AS freight_gross,
    coalesce(po.total_price, po.unit_price * po.quantity) AS product_gross,
    payment.id AS payment_intent_id
  FROM public.pre_orders AS po
  JOIN public.products AS product ON product.id = po.product_id
  JOIN LATERAL (
    SELECT fl.driver_id, fl.driver_offered_price
    FROM public.freight_loads AS fl
    WHERE fl.pre_order_id = po.id
      AND fl.driver_quote_status = 'approved'
      AND fl.buyer_quote_approved IS TRUE
      AND fl.driver_id IS NOT NULL
    ORDER BY fl.created_at DESC
    LIMIT 1
  ) AS freight ON true
  JOIN LATERAL (
    SELECT pi.id
    FROM public.payment_intents AS pi
    WHERE pi.pre_order_id = po.id AND pi.user_id = po.user_id
      AND pi.purpose IN ('order_payment', 'p2p_payment') AND pi.status = 'succeeded'
    ORDER BY pi.completed_at DESC NULLS LAST, pi.created_at DESC
    LIMIT 1
  ) AS payment ON true
  WHERE po.payment_status = 'paid'
)
INSERT INTO public.commissions (
  transaction_id, payment_intent_id, pre_order_id, user_id,
  amount, percentage, type, commission_role, gross_amount, net_amount, settlement_status
)
SELECT NULL, eligible.payment_intent_id, eligible.pre_order_id, fees.user_id,
  fees.amount, fees.percentage, fees.type, fees.commission_role, fees.gross_amount,
  fees.gross_amount - fees.amount, 'pending_payout'
FROM eligible
CROSS JOIN LATERAL (VALUES
  (eligible.supplier_id, round(eligible.product_gross * 0.08, 2), 8::numeric, 'sale'::text, 'supplier'::text, eligible.product_gross),
  (eligible.driver_id, round(eligible.freight_gross * 0.10, 2), 10::numeric, 'freight'::text, 'driver'::text, eligible.freight_gross)
) AS fees(user_id, amount, percentage, type, commission_role, gross_amount)
WHERE fees.user_id IS NOT NULL AND fees.gross_amount > 0
ON CONFLICT (pre_order_id, commission_role)
WHERE pre_order_id IS NOT NULL AND commission_role IS NOT NULL
DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_p2p_order(p_pre_order_id uuid, p_payment_channel text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_order public.pre_orders%rowtype;
  v_freight public.freight_loads%rowtype;
  v_order_id uuid;
  v_intent_id uuid;
  v_amount numeric;
  v_count integer := 0;
  v_b record;
  v_key uuid := gen_random_uuid();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_payment_channel NOT IN ('bank_transfer', 'multicaixa_express', 'unitel_money', 'afrimoney', 'paypay') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_CHANNEL';
  END IF;

  SELECT * INTO v_order
  FROM public.pre_orders AS po
  WHERE po.id = p_pre_order_id AND po.status = 'accepted'
    AND coalesce(po.payment_status, 'unpaid') = 'unpaid'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRE_ORDER_NOT_READY'; END IF;
  IF v_order.user_id <> auth.uid() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;

  SELECT * INTO v_freight
  FROM public.freight_loads AS fl
  WHERE fl.pre_order_id = p_pre_order_id
    AND fl.driver_quote_status = 'approved'
    AND fl.buyer_quote_approved IS TRUE
    AND fl.driver_id IS NOT NULL
  ORDER BY fl.created_at DESC
  LIMIT 1
  FOR SHARE;
  IF NOT FOUND OR v_freight.driver_offered_price IS NULL OR v_freight.driver_offered_price <= 0 THEN
    RAISE EXCEPTION 'FREIGHT_NEGOTIATION_NOT_CLOSED';
  END IF;

  v_amount := coalesce(v_order.total_price, v_order.unit_price * v_order.quantity) + v_freight.driver_offered_price;
  IF v_amount <= 0 THEN RAISE EXCEPTION 'INVALID_PAYMENT_AMOUNT'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.p2p_orders AS o
    WHERE o.pre_order_id = p_pre_order_id
      AND o.status NOT IN ('cancelled', 'expired', 'rejected', 'refunded')
  ) THEN RAISE EXCEPTION 'P2P_ORDER_ALREADY_EXISTS'; END IF;

  INSERT INTO public.p2p_orders(buyer_id, pre_order_id, amount, currency, payment_channel, status, expires_at)
  VALUES(auth.uid(), p_pre_order_id, v_amount, 'AOA', p_payment_channel, 'matching', now() + interval '15 minutes')
  RETURNING id INTO v_order_id;

  INSERT INTO public.payment_intents(
    user_id, provider_id, idempotency_key, amount, currency, status, expires_at,
    purpose, description, provider_payload, pre_order_id
  ) VALUES (
    auth.uid(), 'agrilink_authorized_recipient', v_key, v_amount, 'AOA', 'created',
    now() + interval '15 minutes', 'p2p_payment', 'Pagamento P2P AgriLink (produto + transporte)',
    jsonb_build_object('p2p_order_id', v_order_id, 'payment_channel', p_payment_channel), p_pre_order_id
  ) RETURNING id INTO v_intent_id;

  INSERT INTO public.payment_attempts(payment_intent_id, provider_id, attempt_number, status, request_payload)
  VALUES(v_intent_id, 'agrilink_authorized_recipient', 1, 'created',
    jsonb_build_object('p2p_order_id', v_order_id, 'payment_channel', p_payment_channel));
  UPDATE public.p2p_orders SET payment_intent_id = v_intent_id WHERE id = v_order_id;

  FOR v_b IN
    SELECT b.id AS beneficiary_id, coalesce(r.score, 0) AS score, b.completion_rate, b.average_completion_seconds
    FROM public.p2p_beneficiaries AS b
    JOIN public.p2p_beneficiary_accounts AS a
      ON a.beneficiary_id = b.id AND a.channel = p_payment_channel AND a.active AND a.verified_at IS NOT NULL
    LEFT JOIN public.p2p_reputation AS r ON r.beneficiary_id = b.id
    WHERE b.status = 'active' AND b.availability_status = 'online' AND b.user_id <> auth.uid()
      AND (b.per_transaction_limit = 0 OR b.per_transaction_limit >= v_amount)
      AND (a.max_amount = 0 OR a.max_amount >= v_amount)
      AND (SELECT count(*) FROM public.p2p_orders AS o WHERE o.beneficiary_id = b.id
        AND o.status IN ('accepted', 'payment_pending', 'payment_submitted', 'payment_detected', 'under_review')) < b.simultaneous_limit
      AND (b.daily_limit = 0 OR coalesce((SELECT sum(o.amount) FROM public.p2p_orders AS o
        WHERE o.beneficiary_id = b.id AND o.created_at >= date_trunc('day', now())
          AND o.status NOT IN ('cancelled', 'expired', 'rejected', 'refunded')), 0) + v_amount <= b.daily_limit)
      AND (b.monthly_limit = 0 OR coalesce((SELECT sum(o.amount) FROM public.p2p_orders AS o
        WHERE o.beneficiary_id = b.id AND o.created_at >= date_trunc('month', now())
          AND o.status NOT IN ('cancelled', 'expired', 'rejected', 'refunded')), 0) + v_amount <= b.monthly_limit)
    ORDER BY coalesce(r.score, 0) DESC, b.completion_rate DESC, b.average_completion_seconds ASC, b.updated_at ASC
    LIMIT 5
  LOOP
    INSERT INTO public.p2p_matches(p2p_order_id, beneficiary_id, score)
    VALUES(v_order_id, v_b.beneficiary_id, (v_b.score * 0.7) + (v_b.completion_rate * 0.3));
    v_count := v_count + 1;
  END LOOP;

  IF v_count > 0 THEN
    UPDATE public.p2p_orders SET status = 'offered', updated_at = now() WHERE id = v_order_id;
  END IF;
  INSERT INTO public.p2p_transaction_events(p2p_order_id, event_type, to_status, actor_id, metadata)
  VALUES(v_order_id, 'p2p.order.created', CASE WHEN v_count > 0 THEN 'offered' ELSE 'matching' END,
    auth.uid(), jsonb_build_object('matches', v_count, 'payment_intent_id', v_intent_id, 'freight_included', true));

  RETURN v_order_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_p2p_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_p2p_order(uuid, text) TO authenticated;