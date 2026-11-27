-- Registos internos só podem ser escritos por operações de servidor autorizadas.
-- A criação de indicações é feita pelo trigger de registo; auditoria por triggers/RPCs;
-- verificações de produto por Edge Function com service_role.

DROP POLICY IF EXISTS "Sistema pode criar indicações" ON public.agent_referrals;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.agent_referrals FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Sistema pode inserir logs" ON public.audit_logs;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.audit_logs FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "Sistema insere verificações" ON public.product_verifications;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.product_verifications FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.agent_referrals IS
  'Registos de atribuição de agentes geridos por operações privilegiadas do servidor.';
COMMENT ON TABLE public.audit_logs IS
  'Registos de auditoria imutáveis para clientes; escrita reservada ao servidor e a triggers autorizados.';
COMMENT ON TABLE public.product_verifications IS
  'Resultados de verificação de produtos e fichas criados por Edge Functions autorizadas.';
