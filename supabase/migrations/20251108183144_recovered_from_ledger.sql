-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20251108183144; original ledger name: (NULL).
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

-- Adicionar coluna participant_id na tabela conversations
ALTER TABLE public.conversations
ADD COLUMN participant_id uuid REFERENCES auth.users(id);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_conversations_participant
ON public.conversations(participant_id);

-- Comentário explicativo
COMMENT ON COLUMN public.conversations.participant_id IS 'ID do outro participante da conversa (não o dono da conversa)';
