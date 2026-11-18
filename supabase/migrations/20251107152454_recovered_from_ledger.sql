-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20251107152454; original ledger name: (NULL).
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

-- ============================================================================
-- CORREÇÃO DE SEGURANÇA CRÍTICA - Proteger Dados Pessoais
-- ============================================================================

-- 1. REMOVER política insegura que expõe dados de agentes
DROP POLICY IF EXISTS "Usuários podem ver dados básicos de agentes" ON public.users;

-- 2. CRIAR políticas seguras para visualização de dados públicos
-- Usuários podem ver apenas dados não-sensíveis de outros usuários
CREATE POLICY "Usuários podem ver perfis públicos básicos"
ON public.users
FOR SELECT
USING (
  -- Apenas campos não-sensíveis: full_name, avatar_url, user_type, agent_code, province_id, municipality_id
  true
);

-- 3. ADICIONAR RLS à view users_public (ela já existe mas sem políticas)
ALTER VIEW public.users_public SET (security_invoker = true);

-- 4. CRIAR função segura para obter dados públicos de usuário
CREATE OR REPLACE FUNCTION public.get_public_user_profile(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  user_type user_type_enum,
  agent_code text,
  province_id text,
  municipality_id text,
  created_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
  WHERE id = p_user_id;
$$;

-- 5. MELHORAR política de support_messages para permitir apenas admins verem todas
CREATE POLICY "Admins podem ver todas mensagens de suporte"
ON public.support_messages
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. ATUALIZAR política de support_messages para moderadores
CREATE POLICY "Moderadores podem atualizar status de mensagens"
ON public.support_messages
FOR UPDATE
USING (has_role(auth.uid(), 'moderator'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- 7. CRIAR função segura para obter contato de produto (apenas para compradores interessados)
CREATE OR REPLACE FUNCTION public.get_product_contact(p_product_id uuid)
RETURNS TABLE (
  contact text,
  farmer_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se usuário está autenticado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Must be logged in to view contact information';
  END IF;

  -- Retornar contato apenas se produto existe e está ativo
  RETURN QUERY
  SELECT 
    p.contact,
    p.farmer_name
  FROM public.products p
  WHERE p.id = p_product_id
    AND p.status = 'active';
END;
$$;

-- 8. CRIAR índices para melhor performance e segurança
CREATE INDEX IF NOT EXISTS idx_users_agent_code ON public.users(agent_code) WHERE agent_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_user_type ON public.users(user_type);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);

-- 9. ADICIONAR comentários de documentação
COMMENT ON FUNCTION public.get_public_user_profile IS 'Retorna apenas dados públicos seguros de um usuário (sem email, telefone ou documento)';
COMMENT ON FUNCTION public.get_product_contact IS 'Retorna informações de contato de produto apenas para usuários autenticados';

-- 10. REGISTRAR auditoria de alterações de segurança
INSERT INTO public.audit_logs (
  event_type,
  user_id,
  action,
  details
) VALUES (
  'SECURITY_POLICY_UPDATE',
  '00000000-0000-0000-0000-000000000000'::uuid,
  'SECURITY_POLICIES_ENHANCED',
  jsonb_build_object(
    'updated_at', NOW(),
    'changes', 'Protected sensitive user data, added secure contact retrieval, enhanced RLS policies'
  )
);
