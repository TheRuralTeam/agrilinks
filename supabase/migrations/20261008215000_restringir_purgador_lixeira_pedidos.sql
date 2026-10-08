-- A limpeza definitiva da lixeira é uma rotina de manutenção.
-- Não deve ficar exposta ao cliente nem ao papel authenticated.
REVOKE ALL ON FUNCTION public.purge_expired_pre_order_trash() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_pre_order_trash() TO service_role;
