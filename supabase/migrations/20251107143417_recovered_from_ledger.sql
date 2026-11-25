-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20251107143417; original ledger name: (NULL).
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

-- ==================================================================
-- CORREÇÃO DE SEGURANÇA: Remover Security Definer da View
-- ==================================================================

-- Recriar view sem security definer (security invoker é mais seguro)
DROP VIEW IF EXISTS public.users_public CASCADE;

CREATE VIEW public.users_public 
WITH (security_invoker = true)
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
FROM public.users;

COMMENT ON VIEW public.users_public IS 
'View pública com dados não-sensíveis de usuários. Usa security_invoker para respeitar RLS do usuário que executa a query.';
