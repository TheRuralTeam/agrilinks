-- Funções executadas internamente por triggers não precisam de acesso via API.
-- Mantemos SECURITY DEFINER para os triggers, mas fechamos EXECUTE para clientes.

REVOKE EXECUTE ON FUNCTION public.sync_product_likes_count() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_marketplace_reservation_on_status() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_conversation_on_message() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_message_conversation() FROM anon, authenticated;
