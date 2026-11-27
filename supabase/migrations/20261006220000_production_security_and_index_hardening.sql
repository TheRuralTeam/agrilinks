-- Production hardening: restrict elevated RPCs, pin SECURITY DEFINER
-- search paths, and remove confirmed duplicate indexes/constraints.

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Explicit anonymous RPC allow-list used by registration/verification.
GRANT EXECUTE ON FUNCTION public.get_agent_id_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_agent_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_email_otp(text, text) TO anon, authenticated;

ALTER FUNCTION public.send_message(uuid, uuid, text, jsonb) SET search_path = public;
ALTER FUNCTION public.send_message(uuid, uuid, uuid, text) SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.payment_status_transition_allowed(text, text) SET search_path = public;

-- Confirmed identical indexes.
DROP INDEX IF EXISTS public.idx_conversations_participant_id;
DROP INDEX IF EXISTS public.idx_messages_conversation_id;
DROP INDEX IF EXISTS public.payment_intents_order_id_idx;
DROP INDEX IF EXISTS public.payment_intents_status_idx;
DROP INDEX IF EXISTS public.payment_intents_user_created_idx;

-- Keep one canonical UNIQUE constraint for webhook idempotency.
ALTER TABLE public.payment_webhook_events
  DROP CONSTRAINT IF EXISTS payment_webhook_events_provider_id_provider_event_id_key;
DROP INDEX IF EXISTS public.ux_payment_webhook_provider_event;
