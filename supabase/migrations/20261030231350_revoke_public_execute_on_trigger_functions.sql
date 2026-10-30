-- These are trigger-only functions (RETURNS trigger), not callable application RPCs.
-- Triggers already exist and retain their function bindings; revoke direct API execution
-- from client roles while preserving owner/service-role access for operational tooling.
REVOKE EXECUTE ON FUNCTION public.enqueue_sourcing_agent_intake() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_freight_load_order_participants() FROM PUBLIC, anon, authenticated;
