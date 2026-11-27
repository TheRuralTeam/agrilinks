-- Remove duplicate trigger registrations left by incremental migrations.
-- Keep the canonical trigger names already used by the current schema.

DROP TRIGGER IF EXISTS trigger_notify_message_sent ON public.messages;
DROP TRIGGER IF EXISTS trg_set_message_conversation ON public.messages;
DROP TRIGGER IF EXISTS products_updated_at ON public.products;
DROP TRIGGER IF EXISTS trigger_notify_product_created ON public.products;
DROP TRIGGER IF EXISTS trigger_notify_product_updated ON public.products;
DROP TRIGGER IF EXISTS trigger_notify_support_message_created ON public.support_messages;
DROP TRIGGER IF EXISTS before_insert_assign_agent_code ON public.users;
DROP TRIGGER IF EXISTS process_agent_referral_trigger ON public.users;
DROP TRIGGER IF EXISTS users_updated_at ON public.users;
