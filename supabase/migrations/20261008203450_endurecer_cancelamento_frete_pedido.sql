-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261008203450; original ledger name: endurecer_cancelamento_frete_pedido.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.


CREATE OR REPLACE FUNCTION public.cancel_freight_load_for_cancelled_pre_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_freight public.freight_loads%ROWTYPE;
  v_pre_order public.pre_orders%ROWTYPE;
BEGIN
  IF OLD.status = 'accepted' AND NEW.status IN ('cancelled', 'rejected') THEN
    SELECT *
    INTO v_pre_order
    FROM public.pre_orders
    WHERE id = NEW.id
    FOR UPDATE;

    IF v_pre_order.payment_status IN ('paid', 'partially_refunded') THEN
      RAISE EXCEPTION 'A paid order requires a refund workflow before cancellation'
        USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO v_freight
    FROM public.freight_loads
    WHERE pre_order_id = NEW.id
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      IF v_freight.status IN ('in_transit', 'delivered') THEN
        RAISE EXCEPTION 'An order cannot be cancelled after GPS transport has started'
          USING ERRCODE = '22023';
      END IF;

      UPDATE public.freight_loads
      SET status = 'cancelled',
          driver_id = NULL,
          accepted_at = NULL,
          driver_offered_price = NULL,
          driver_price_method = NULL,
          driver_quote_status = CASE
            WHEN v_freight.driver_id IS NOT NULL THEN 'rejected'
            ELSE v_freight.driver_quote_status
          END,
          updated_at = NOW()
      WHERE id = v_freight.id;

      INSERT INTO public.audit_logs (event_type, action, user_id, details)
      VALUES (
        'FREIGHT_LOAD_STATUS_CHANGED',
        'FREIGHT_CANCELLED_WITH_PRE_ORDER',
        COALESCE(v_freight.driver_id, auth.uid()),
        jsonb_build_object(
          'freight_load_id', v_freight.id,
          'pre_order_id', NEW.id,
          'previous_status', v_freight.status,
          'previous_driver_id', v_freight.driver_id,
          'reason', 'pre_order_cancelled_or_rejected'
        )
      );
    END IF;

    UPDATE public.payment_intents
    SET status = 'cancelled',
        failure_code = 'PRE_ORDER_CANCELLED',
        failure_message = 'Pagamento cancelado porque o pedido foi cancelado ou rejeitado.',
        updated_at = NOW()
    WHERE pre_order_id = NEW.id
      AND status IN ('created', 'processing');

    UPDATE public.payment_attempts pa
    SET status = 'failed',
        failure_code = 'PRE_ORDER_CANCELLED',
        failure_message = 'Tentativa de pagamento cancelada porque o pedido foi cancelado ou rejeitado.',
        updated_at = NOW()
    FROM public.payment_intents pi
    WHERE pa.payment_intent_id = pi.id
      AND pi.pre_order_id = NEW.id
      AND pa.status NOT IN ('succeeded', 'failed', 'cancelled', 'expired');
  END IF;

  RETURN NEW;
END;
$function$;
