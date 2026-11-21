-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20251107143222; original ledger name: (NULL).
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

-- ==================================================================
-- CORREÇÃO DO SISTEMA DE AUTENTICAÇÃO E VERIFICAÇÃO DE EMAIL
-- Versão corrigida com ordem adequada de remoção de dependências
-- ==================================================================

-- 1. REMOVER TRIGGERS PRIMEIRO (antes das funções)
-- ==================================================================
DROP TRIGGER IF EXISTS on_user_confirmed ON auth.users;
DROP TRIGGER IF EXISTS sync_user_confirmation_trigger ON auth.users;
DROP TRIGGER IF EXISTS sync_email_verification_trigger ON auth.users;

-- 2. REMOVER FUNÇÕES COM CASCADE
-- ==================================================================
DROP FUNCTION IF EXISTS public.sync_user_confirmation() CASCADE;
DROP FUNCTION IF EXISTS public.sync_email_verification() CASCADE;

-- 3. CORRIGIR ESTRUTURA DA TABELA AUDIT_LOGS
-- ==================================================================
-- Adicionar colunas necessárias para os logs de autenticação
ALTER TABLE public.audit_logs
ADD COLUMN IF NOT EXISTS event_type TEXT,
ADD COLUMN IF NOT EXISTS user_email TEXT,
ADD COLUMN IF NOT EXISTS user_type TEXT,
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS details JSONB;

-- Manter coluna antiga por compatibilidade
ALTER TABLE public.audit_logs
ADD COLUMN IF NOT EXISTS action TEXT;

-- 4. HABILITAR RLS NA TABELA AUDIT_LOGS
-- ==================================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Apenas admins podem ver logs de auditoria" ON public.audit_logs;
DROP POLICY IF EXISTS "Sistema pode inserir logs" ON public.audit_logs;

-- Apenas admins podem ver logs de auditoria
CREATE POLICY "Apenas admins podem ver logs de auditoria"
ON public.audit_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Sistema pode inserir logs (via SECURITY DEFINER functions)
CREATE POLICY "Sistema pode inserir logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (true);

-- 5. REMOVER CAMPOS NÃO UTILIZADOS DE VERIFICAÇÃO CUSTOMIZADA
-- ==================================================================
ALTER TABLE public.users 
DROP COLUMN IF EXISTS verification_code CASCADE,
DROP COLUMN IF EXISTS verification_code_expires_at CASCADE;

-- 6. CRIAR TRIGGER ÚNICO E OTIMIZADO PARA SINCRONIZAÇÃO DE EMAIL
-- ==================================================================
CREATE OR REPLACE FUNCTION public.sync_email_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_type TEXT;
BEGIN
  -- Verificar se o email foi confirmado
  IF NEW.email_confirmed_at IS NOT NULL 
     AND (OLD.email_confirmed_at IS NULL OR NEW.email_confirmed_at <> OLD.email_confirmed_at) THEN
     
     -- Buscar tipo de usuário
     SELECT user_type::TEXT
     INTO v_user_type
     FROM public.users
     WHERE email = NEW.email
     LIMIT 1;
     
     -- Atualizar verificação de email na tabela users
     UPDATE public.users
     SET email_verified = true,
         updated_at = NOW()
     WHERE email = NEW.email;
     
     -- Registrar no audit log
     INSERT INTO public.audit_logs (
       event_type,
       user_email,
       user_id,
       user_type,
       ip_address,
       details,
       action
     )
     VALUES (
       'EMAIL_CONFIRMED',
       NEW.email,
       NEW.id,
       v_user_type,
       current_setting('request.headers', true)::json->>'x-real-ip',
       jsonb_build_object(
         'confirmed_at', NEW.email_confirmed_at,
         'auth_role', current_user,
         'trigger_time', NOW()
       ),
       'EMAIL_CONFIRMED'
     );
  END IF;

  RETURN NEW;
END;
$$;

-- Criar trigger para sincronização
CREATE TRIGGER sync_email_verification_trigger
AFTER UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_email_verification();

-- 7. CRIAR VIEW PÚBLICA PARA DADOS NÃO-SENSÍVEIS DE USUÁRIOS
-- ==================================================================
DROP VIEW IF EXISTS public.users_public CASCADE;

CREATE VIEW public.users_public AS
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

-- 8. MELHORAR POLÍTICAS RLS DA TABELA USERS
-- ==================================================================
-- Remover política se já existir
DROP POLICY IF EXISTS "Usuários podem ver dados básicos de agentes" ON public.users;

-- Adicionar política para permitir visualização de dados públicos específicos
CREATE POLICY "Usuários podem ver dados básicos de agentes"
ON public.users
FOR SELECT
USING (
  -- Usuário pode ver seus próprios dados completos
  auth.uid() = id 
  OR 
  -- Ou dados limitados de agentes (para referências)
  (user_type = 'agente' AND agent_code IS NOT NULL)
);

-- 9. OTIMIZAR FUNÇÃO handle_new_user PARA GARANTIR SINCRONIZAÇÃO
-- ==================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    phone,
    full_name,
    identity_document,
    user_type,
    province_id,
    municipality_id,
    referred_by_agent_id,
    email_verified,
    phone_verified
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'identity_document',
    (NEW.raw_user_meta_data->>'user_type')::user_type_enum,
    NEW.raw_user_meta_data->>'province_id',
    NEW.raw_user_meta_data->>'municipality_id',
    (NEW.raw_user_meta_data->>'referred_by_agent_id')::uuid,
    -- Se o email já vem confirmado (alguns providers OAuth), marcar como verificado
    CASE 
      WHEN NEW.email_confirmed_at IS NOT NULL THEN true
      ELSE false
    END,
    false
  );
  
  -- Registrar criação de usuário no audit log
  INSERT INTO public.audit_logs (
    event_type,
    user_email,
    user_id,
    user_type,
    details,
    action
  )
  VALUES (
    'USER_CREATED',
    NEW.email,
    NEW.id,
    NEW.raw_user_meta_data->>'user_type',
    jsonb_build_object(
      'signup_method', NEW.raw_app_meta_data->>'provider',
      'created_at', NEW.created_at
    ),
    'USER_CREATED'
  );
  
  RETURN NEW;
END;
$$;

-- 10. CRIAR FUNÇÃO PARA REENVIAR EMAIL DE CONFIRMAÇÃO (HELPER)
-- ==================================================================
CREATE OR REPLACE FUNCTION public.request_email_confirmation(user_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_verified BOOLEAN;
BEGIN
  -- Buscar usuário
  SELECT id, email_verified
  INTO v_user_id, v_is_verified
  FROM public.users
  WHERE email = user_email
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Usuário não encontrado');
  END IF;
  
  IF v_is_verified THEN
    RETURN jsonb_build_object('error', 'Email já verificado');
  END IF;
  
  -- Registrar solicitação no audit log
  INSERT INTO public.audit_logs (
    event_type,
    user_email,
    user_id,
    details,
    action
  )
  VALUES (
    'CONFIRMATION_EMAIL_REQUESTED',
    user_email,
    v_user_id,
    jsonb_build_object('requested_at', NOW()),
    'CONFIRMATION_EMAIL_REQUESTED'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Solicitação registrada. Use o painel do Supabase para reenviar o email.'
  );
END;
$$;

-- 11. COMENTÁRIOS E DOCUMENTAÇÃO
-- ==================================================================
COMMENT ON FUNCTION public.sync_email_verification() IS 
'Trigger function que sincroniza a verificação de email do auth.users para public.users e registra no audit log';

COMMENT ON VIEW public.users_public IS 
'View pública com dados não-sensíveis de usuários que podem ser visualizados por todos';

COMMENT ON FUNCTION public.request_email_confirmation(TEXT) IS 
'Função helper para registrar solicitações de reenvio de email de confirmação';
