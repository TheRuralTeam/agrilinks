-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20251107143259; original ledger name: (NULL).
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

-- ==================================================================
-- CORREÇÃO DE SEGURANÇA: Remover Security Definer da View
-- ==================================================================

-- A view users_public não deve ter security_invoker = true
-- pois ela é destinada a acesso público e não precisa de elevação de privilégios

DROP VIEW IF EXISTS public.users_public CASCADE;

CREATE VIEW public.users_public 
WITH (security_barrier = true)
AS
SELECT 
  id,
  full_name,
  avatar_url,
  user_type,
  agent_code,
  province_id,
  municipality_id,
  created_at
FROM public.users
WHERE user_type = 'agente' AND agent_code IS NOT NULL;

-- Adicionar comentário explicativo
COMMENT ON VIEW public.users_public IS 
'View pública com dados não-sensíveis de agentes. Usa security_barrier para garantir que os filtros WHERE sejam aplicados antes de qualquer outra operação.';
