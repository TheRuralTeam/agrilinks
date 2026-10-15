BEGIN;

-- Legacy RPC is no longer used by the client. The supported workflow is
-- advance_freight_load_status(uuid, text), which enforces explicit transitions.
REVOKE ALL ON FUNCTION public.advance_freight_load(uuid) FROM PUBLIC, anon, authenticated;

-- This helper is invoked by SECURITY DEFINER business functions after the
-- supplier handover and buyer receipt confirmations. It must not be callable
-- directly through PostgREST by anon/authenticated clients.
REVOKE ALL ON FUNCTION public.create_freight_settlement_if_ready(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_freight_settlement_if_ready(uuid)
  TO service_role;

-- These RPCs are intended for signed-in users. The function bodies still
-- perform actor/ownership checks; removing anon EXECUTE is defense in depth.
-- Administrative product moderation is authenticated-only; its body also
-- verifies admin/root-admin identity before updating the product.
REVOKE EXECUTE ON FUNCTION public.admin_set_product_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_product_status(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.accept_freight_load(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_freight_load(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.confirm_freight_handover(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_freight_handover(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.confirm_freight_receipt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_freight_receipt(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_freight_tracking_location(uuid, double precision, double precision)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_freight_tracking_location(uuid, double precision, double precision)
  TO authenticated;

COMMIT;
