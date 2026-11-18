-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20251108042130; original ledger name: (NULL).
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

-- Criar função para notificar quando uma mensagem é enviada
CREATE OR REPLACE FUNCTION public.notify_message_sent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name TEXT;
  v_message_preview TEXT;
BEGIN
  -- Buscar nome do remetente
  SELECT full_name INTO v_sender_name
  FROM public.users
  WHERE id = NEW.sender_id;
  
  -- Criar preview da mensagem (primeiros 50 caracteres)
  v_message_preview := substring(NEW.content from 1 for 50);
  IF length(NEW.content) > 50 THEN
    v_message_preview := v_message_preview || '...';
  END IF;
  
  -- Criar notificação para o destinatário
  PERFORM create_notification(
    NEW.receiver_id,
    'message',
    'Nova Mensagem de ' || COALESCE(v_sender_name, 'Usuário'),
    v_message_preview,
    jsonb_build_object(
      'message_id', NEW.id,
      'sender_id', NEW.sender_id,
      'sender_name', v_sender_name,
      'conversation_id', NEW.conversation_id
    )
  );
  
  RETURN NEW;
END;
$$;

-- Criar trigger para notificar quando mensagem é inserida
DROP TRIGGER IF EXISTS trigger_notify_message_sent ON public.messages;
CREATE TRIGGER trigger_notify_message_sent
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_message_sent();

-- Criar função para notificar quando uma ficha de recebimento é criada
CREATE OR REPLACE FUNCTION public.notify_ficha_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM create_notification(
    NEW.user_id,
    'ficha',
    'Ficha de Recebimento Criada',
    'Sua ficha "' || NEW.nome_ficha || '" foi criada com sucesso!',
    jsonb_build_object(
      'ficha_id', NEW.id,
      'nome_ficha', NEW.nome_ficha,
      'tipo_negocio', NEW.tipo_negocio,
      'produto', NEW.produto
    )
  );
  RETURN NEW;
END;
$$;

-- Criar trigger para notificar quando ficha é criada
DROP TRIGGER IF EXISTS trigger_notify_ficha_created ON public.fichas_recebimento;
CREATE TRIGGER trigger_notify_ficha_created
  AFTER INSERT ON public.fichas_recebimento
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ficha_created();

-- Adicionar índices para melhorar performance das consultas
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
