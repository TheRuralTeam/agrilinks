-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20251114115939; original ledger name: (NULL).
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

-- ============================================
-- LIMPEZA DE POLÍTICAS RLS DUPLICADAS
-- ============================================

-- Remover TODAS as políticas de conversations
DROP POLICY IF EXISTS "Allow owner to insert" ON public.conversations;
DROP POLICY IF EXISTS "Allow owner to select" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert conversations they participate in" ON public.conversations;
DROP POLICY IF EXISTS "Users can update own or participant conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view own or participant conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can manage their own conversations" ON public.conversations;

-- Criar política unificada para conversations
CREATE POLICY "Users can manage their own conversations" 
ON public.conversations
FOR ALL
USING (auth.uid() = user_id OR auth.uid() = participant_id OR auth.uid() = peer_user_id)
WITH CHECK (auth.uid() = user_id OR auth.uid() = participant_id OR auth.uid() = peer_user_id);

-- Remover TODAS as políticas de messages
DROP POLICY IF EXISTS "Allow sender or receiver to select" ON public.messages;
DROP POLICY IF EXISTS "Allow sender to insert" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages as sender" ON public.messages;
DROP POLICY IF EXISTS "Users can view their messages" ON public.messages;
DROP POLICY IF EXISTS "Usuários podem atualizar mensagens recebidas (marcar lida)" ON public.messages;
DROP POLICY IF EXISTS "Usuários podem inserir mensagens como remetente" ON public.messages;
DROP POLICY IF EXISTS "Usuários podem ver mensagens enviadas ou recebidas" ON public.messages;
DROP POLICY IF EXISTS "Users can manage their messages" ON public.messages;

-- Criar políticas simplificadas para messages
CREATE POLICY "Users can view their messages" 
ON public.messages
FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" 
ON public.messages
FOR INSERT
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update received messages" 
ON public.messages
FOR UPDATE
USING (auth.uid() = receiver_id);

-- ============================================
-- CORRIGIR SEARCH_PATH DAS FUNÇÕES
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.conversations
  SET last_message = NEW.content,
      last_timestamp = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_message_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.conversation_id IS NULL THEN
    NEW.conversation_id := public.get_or_create_conversation(NEW.sender_id, NEW.receiver_id);
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================
-- HABILITAR REALTIME (apenas garantir REPLICA IDENTITY)
-- ============================================

ALTER TABLE public.fichas_recebimento REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ============================================
-- CRIAR TRIGGERS NECESSÁRIOS
-- ============================================

DROP TRIGGER IF EXISTS update_fichas_recebimento_updated_at ON public.fichas_recebimento;
CREATE TRIGGER update_fichas_recebimento_updated_at
  BEFORE UPDATE ON public.fichas_recebimento
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversation_trigger ON public.messages;
CREATE TRIGGER update_conversation_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_on_message();

DROP TRIGGER IF EXISTS set_conversation_trigger ON public.messages;
CREATE TRIGGER set_conversation_trigger
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_message_conversation();

DROP TRIGGER IF EXISTS notify_ficha_created_trigger ON public.fichas_recebimento;
CREATE TRIGGER notify_ficha_created_trigger
  AFTER INSERT ON public.fichas_recebimento
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ficha_created();

DROP TRIGGER IF EXISTS notify_message_trigger ON public.messages;
CREATE TRIGGER notify_message_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_message_sent();
