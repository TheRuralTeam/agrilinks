-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20251022113559; original ledger name: (NULL).
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

-- Criar tabela de notificações
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índice para melhor performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Habilitar Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver suas próprias notificações"
ON public.notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias notificações"
ON public.notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Sistema pode criar notificações"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Função para criar notificações
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_metadata)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Trigger para notificar quando produto é criado
CREATE OR REPLACE FUNCTION public.notify_product_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM create_notification(
    NEW.user_id,
    'product',
    'Produto Publicado',
    'Seu produto "' || NEW.product_type || '" foi publicado com sucesso!',
    jsonb_build_object('product_id', NEW.id, 'product_type', NEW.product_type)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_product_created
AFTER INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.notify_product_created();

-- Trigger para notificar quando produto é atualizado
CREATE OR REPLACE FUNCTION public.notify_product_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    PERFORM create_notification(
      NEW.user_id,
      'product',
      'Produto Atualizado',
      'Status do seu produto "' || NEW.product_type || '" foi alterado para: ' || NEW.status,
      jsonb_build_object('product_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_product_updated
AFTER UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.notify_product_updated();

-- Trigger para notificar quando transação é criada
CREATE OR REPLACE FUNCTION public.notify_transaction_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.wallets
  WHERE id = NEW.wallet_id;
  
  PERFORM create_notification(
    v_user_id,
    'transaction',
    'Nova Transação',
    'Nova transação de ' || NEW.type || ' no valor de ' || NEW.amount || ' AOA',
    jsonb_build_object('transaction_id', NEW.id, 'type', NEW.type, 'amount', NEW.amount)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_transaction_created
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.notify_transaction_created();

-- Trigger para notificar quando transação é completada
CREATE OR REPLACE FUNCTION public.notify_transaction_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    SELECT user_id INTO v_user_id
    FROM public.wallets
    WHERE id = NEW.wallet_id;
    
    PERFORM create_notification(
      v_user_id,
      'transaction',
      'Transação Completada',
      'Sua transação de ' || NEW.type || ' no valor de ' || NEW.amount || ' AOA foi completada!',
      jsonb_build_object('transaction_id', NEW.id, 'type', NEW.type, 'amount', NEW.amount)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_transaction_completed
AFTER UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.notify_transaction_completed();

-- Trigger para notificar quando mensagem de suporte é criada
CREATE OR REPLACE FUNCTION public.notify_support_message_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    PERFORM create_notification(
      NEW.user_id,
      'support',
      'Mensagem de Suporte Enviada',
      'Sua mensagem de suporte foi recebida. Nossa equipe responderá em breve!',
      jsonb_build_object('message_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_support_message_created
AFTER INSERT ON public.support_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_support_message_created();
