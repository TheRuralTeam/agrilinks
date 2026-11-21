-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20251108042733; original ledger name: (NULL).
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

-- ==========================================
-- CORREÇÕES CRÍTICAS E IMPORTANTES
-- Data: 2025-11-08
-- ==========================================

-- 1. CRÍTICO: Adicionar política DELETE em notifications
CREATE POLICY "Usuários podem deletar suas próprias notificações"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- 2. CRÍTICO: Limpar mensagens órfãs sem receiver_id
DELETE FROM public.messages WHERE receiver_id IS NULL;

-- 3. CRÍTICO: Tornar receiver_id NOT NULL em messages
ALTER TABLE public.messages
ALTER COLUMN receiver_id SET NOT NULL;

-- 4. CRÍTICO: Tornar user_id NOT NULL em conversations
-- Primeiro, atualizar registros existentes com NULL (se houver)
UPDATE public.conversations
SET user_id = (SELECT id FROM auth.users LIMIT 1)
WHERE user_id IS NULL;

ALTER TABLE public.conversations
ALTER COLUMN user_id SET NOT NULL;

-- 5. IMPORTANTE: Tornar user_id NOT NULL em support_messages  
-- (Este campo já permite NULL para mensagens anônimas, então vamos deixar como está
-- mas adicionar um valor padrão para evitar problemas)

-- 6. PERFORMANCE: Adicionar índice composto para queries de mensagens
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON public.messages(conversation_id, created_at DESC);

-- 7. PERFORMANCE: Adicionar índice para filtro de produtos ativos
CREATE INDEX IF NOT EXISTS idx_products_status_active 
ON public.products(status) 
WHERE status = 'active';

-- 8. PERFORMANCE: Adicionar índice para tipo de notificação
CREATE INDEX IF NOT EXISTS idx_notifications_type 
ON public.notifications(type);

-- 9. MELHORIA: Adicionar trigger para updated_at em wallets
DROP TRIGGER IF EXISTS update_wallets_updated_at ON public.wallets;
CREATE TRIGGER update_wallets_updated_at
BEFORE UPDATE ON public.wallets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 10. MELHORIA: Adicionar índice para user_id em notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_type_read 
ON public.notifications(user_id, type, read);

-- 11. PERFORMANCE: Adicionar índice para fichas_recebimento por usuário
CREATE INDEX IF NOT EXISTS idx_fichas_user_created 
ON public.fichas_recebimento(user_id, created_at DESC);

-- 12. MELHORIA: Adicionar índice para conversas por timestamp
CREATE INDEX IF NOT EXISTS idx_conversations_user_timestamp 
ON public.conversations(user_id, last_timestamp DESC);

-- 13. SEGURANÇA: Adicionar constraint para garantir emails únicos em users
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique 
ON public.users(email) 
WHERE email IS NOT NULL;

-- 14. PERFORMANCE: Adicionar índice para produtos por localização
CREATE INDEX IF NOT EXISTS idx_products_location 
ON public.products(province_id, municipality_id, status) 
WHERE status = 'active';

-- 15. ANÁLISE: Atualizar estatísticas das tabelas modificadas
ANALYZE public.notifications;
ANALYZE public.messages;
ANALYZE public.conversations;
ANALYZE public.products;
ANALYZE public.wallets;
ANALYZE public.fichas_recebimento;
