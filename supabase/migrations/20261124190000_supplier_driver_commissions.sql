-- O frete é negociado entre motorista e comprador. O fornecedor participa
-- apenas como vendedor e não precisa aprovar a proposta de transporte.
ALTER TABLE public.freight_loads
  ALTER COLUMN supplier_quote_approved SET DEFAULT true;

UPDATE public.freight_loads
SET supplier_quote_approved = true
WHERE supplier_quote_approved IS DISTINCT FROM true;

ALTER TABLE public.freight_loads
  ALTER COLUMN supplier_quote_approved SET DEFAULT true;

CREATE OR REPLACE FUNCTION public.keep_supplier_freight_approval_nonblocking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.pre_order_id IS NOT NULL THEN
    NEW.supplier_quote_approved := true;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.keep_supplier_freight_approval_nonblocking() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_keep_supplier_freight_approval_nonblocking ON public.freight_loads;
CREATE TRIGGER trg_keep_supplier_freight_approval_nonblocking
  BEFORE INSERT OR UPDATE OF driver_quote_status ON public.freight_loads
  FOR EACH ROW
  EXECUTE FUNCTION public.keep_supplier_freight_approval_nonblocking();

CREATE OR REPLACE FUNCTION public.respond_to_freight_quote(
  p_freight_load_id uuid,
  p_approved boolean
)
RETURNS TABLE(id uuid, status text, driver_offered_price numeric, driver_quote_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_load public.freight_loads%rowtype;
  v_buyer_id uuid;
  v_supplier_id uuid;
  v_new_status text;
  v_message text;
BEGIN
  IF v_actor_id IS NULL OR p_freight_load_id IS NULL OR p_approved IS NULL THEN
    RAISE EXCEPTION 'Invalid freight quote response' USING ERRCODE = '42501';
  END IF;

  SELECT fl.* INTO v_load
  FROM public.freight_loads AS fl
  WHERE fl.id = p_freight_load_id AND fl.pre_order_id IS NOT NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Freight quote not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_load.driver_quote_status <> 'pending_buyer_approval' THEN
    RAISE EXCEPTION 'This freight quote is no longer open for negotiation' USING ERRCODE = '22023';
  END IF;

  SELECT po.user_id, coalesce(v_load.supplier_id, p.user_id)
  INTO v_buyer_id, v_supplier_id
  FROM public.pre_orders AS po
  JOIN public.products AS p ON p.id = po.product_id
  WHERE po.id = v_load.pre_order_id AND po.status = 'accepted';
  IF v_buyer_id IS NULL OR v_supplier_id IS NULL THEN
    RAISE EXCEPTION 'Accepted order participants could not be resolved' USING ERRCODE = 'P0002';
  END IF;
  IF v_actor_id <> v_buyer_id THEN
    RAISE EXCEPTION 'Only the buyer may approve or reject the driver price' USING ERRCODE = '42501';
  END IF;

  v_new_status := CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END;
  v_message := CASE
    WHEN p_approved THEN 'O comprador aprovou o preço do motorista. A negociação do frete está concluída; o pagamento pode continuar.'
    ELSE 'O comprador recusou o preço do motorista. O motorista pode rever a proposta e enviar um novo valor.'
  END;

  UPDATE public.freight_loads AS fl
  SET buyer_quote_approved = p_approved,
      supplier_quote_approved = true,
      driver_quote_status = v_new_status,
      updated_at = now()
  WHERE fl.id = p_freight_load_id
  RETURNING fl.* INTO v_load;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  SELECT DISTINCT party.user_id,
    CASE WHEN p_approved THEN 'freight_quote_approved' ELSE 'freight_quote_update' END,
    CASE WHEN p_approved THEN 'Preço de transporte aprovado' ELSE 'Proposta de transporte recusada' END,
    v_message,
    jsonb_build_object(
      'pre_order_id', v_load.pre_order_id,
      'freight_load_id', v_load.id,
      'driver_quote_status', v_new_status,
      'path', CASE WHEN party.user_id = v_supplier_id THEN '/perfil?tab=orders' ELSE '/cargas' END
    )
  FROM (VALUES (v_supplier_id), (v_load.driver_id)) AS party(user_id)
  WHERE party.user_id IS NOT NULL AND party.user_id <> v_actor_id;

  RETURN QUERY SELECT v_load.id, v_load.status, v_load.driver_offered_price, v_load.driver_quote_status;
END;
$function$;

REVOKE ALL ON FUNCTION public.respond_to_freight_quote(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_freight_quote(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_supplier_of_driver_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_supplier_id uuid;
BEGIN
  IF NEW.pre_order_id IS NULL
    OR NEW.driver_quote_status IS DISTINCT FROM 'pending_buyer_approval'
    OR OLD.driver_quote_status = 'pending_buyer_approval' THEN
    RETURN NEW;
  END IF;

  v_supplier_id := NEW.supplier_id;
  IF v_supplier_id IS NULL THEN
    SELECT p.user_id INTO v_supplier_id FROM public.products AS p WHERE p.id = NEW.product_id;
  END IF;

  IF v_supplier_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      v_supplier_id,
      'freight_quote',
      'Proposta de transporte recebida',
      format('O motorista propôs %s Kz para transportar %s kg de %s para %s. O comprador decide o preço; a comissão do fornecedor é 8%% sobre o produto quando o pagamento for confirmado.',
        to_char(NEW.driver_offered_price, 'FM999G999G999G990D00'),
        to_char(NEW.weight_kg, 'FM999G999G999G990D00'), NEW.origin_label, NEW.destination_label),
      jsonb_build_object('pre_order_id', NEW.pre_order_id, 'freight_load_id', NEW.id, 'path', '/perfil?tab=orders')
    );
  END IF;
  RETURN NEW;
END;
$function$;

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
    AND fl.supplier_quote_approved IS TRUE
    AND fl.driver_id IS NOT NULL
  ORDER BY fl.created_at DESC
  LIMIT 1;
  SELECT pi.id INTO v_intent_id
  FROM public.payment_intents AS pi
  WHERE pi.pre_order_id = NEW.id
    AND pi.user_id = NEW.user_id
    AND pi.purpose = 'order_payment'
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

DROP POLICY IF EXISTS "Administrators view marketplace commissions" ON public.commissions;
CREATE POLICY "Administrators view marketplace commissions"
  ON public.commissions FOR SELECT TO authenticated
  USING (
    public.is_root_admin(auth.uid())
    OR public.has_admin_permission(auth.uid(), 'view_analytics'::public.admin_permission)
  );
GRANT SELECT ON public.commissions TO authenticated;

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
    ORDER BY fl.created_at DESC LIMIT 1
  ) AS freight ON true
  JOIN LATERAL (
    SELECT pi.id
    FROM public.payment_intents AS pi
    WHERE pi.pre_order_id = po.id AND pi.user_id = po.user_id
      AND pi.purpose = 'order_payment' AND pi.status = 'succeeded'
    ORDER BY pi.completed_at DESC NULLS LAST, pi.created_at DESC LIMIT 1
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