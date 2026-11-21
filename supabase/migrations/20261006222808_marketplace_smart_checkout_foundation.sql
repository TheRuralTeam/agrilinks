-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261006222808; original ledger name: marketplace_smart_checkout_foundation.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.pre_orders%ROWTYPE;
  v_freight numeric := 0;
BEGIN
  SELECT * INTO v_order
  FROM public.pre_orders
  WHERE id = p_pre_order_id
    AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE='P0002';
  END IF;

  IF v_order.status <> 'accepted' THEN
    RETURN QUERY SELECT v_order.id,v_order.total_price,0::numeric,v_order.total_price,'AOA'::text,false,'WAITING_SELLER_ACCEPTANCE'::text;
    RETURN;
  END IF;

  SELECT COALESCE(fl.offered_price, fl.driver_offered_price, 0)
  INTO v_freight
  FROM public.freight_loads fl
  WHERE fl.pre_order_id = v_order.id
  ORDER BY fl.created_at DESC
  LIMIT 1;

  RETURN QUERY SELECT
    v_order.id,
    v_order.total_price,
    v_freight,
    v_order.total_price + v_freight,
    'AOA'::text,
    (v_freight > 0),
    CASE WHEN v_freight > 0 THEN 'READY' ELSE 'WAITING_FREIGHT_QUOTE' END;
END;
$$;

REVOKE ALL ON FUNCTION public.get_marketplace_checkout_summary(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_marketplace_checkout_summary(uuid) TO authenticated;
