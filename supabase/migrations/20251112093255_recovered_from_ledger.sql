-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20251112093255; original ledger name: (NULL).
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

-- 1) RLS e modelo de conversas para suportar dois participantes e 1 conversa por par
-- Atualiza políticas para permitir acesso por user_id OU participant_id
DROP POLICY IF EXISTS "Usuário pode atualizar suas próprias conversas" ON public.conversations;
DROP POLICY IF EXISTS "Usuário pode inserir suas próprias conversas" ON public.conversations;
DROP POLICY IF EXISTS "Usuário pode ver apenas suas conversas" ON public.conversations;

CREATE POLICY "Users can view own or participant conversations"
ON public.conversations
FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = COALESCE(participant_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE POLICY "Users can insert conversations they participate in"
ON public.conversations
FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.uid() = participant_id);

CREATE POLICY "Users can update own or participant conversations"
ON public.conversations
FOR UPDATE
USING (auth.uid() = user_id OR auth.uid() = participant_id);

-- Índice único para garantir 1 conversa por par (quando participant_id não é nulo)
CREATE UNIQUE INDEX IF NOT EXISTS conversations_unique_pair
ON public.conversations (LEAST(user_id, participant_id), GREATEST(user_id, participant_id))
WHERE participant_id IS NOT NULL;

-- 2) Função utilitária: obter/criar conversa para um par
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(p_user_id uuid, p_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_conv_id uuid;
BEGIN
  SELECT id INTO v_conv_id
  FROM public.conversations
  WHERE LEAST(user_id, participant_id) = LEAST(p_user_id, p_other_user_id)
    AND GREATEST(user_id, participant_id) = GREATEST(p_user_id, p_other_user_id)
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    INSERT INTO public.conversations (user_id, participant_id, title, last_timestamp, unread_count)
    VALUES (p_user_id, p_other_user_id, 'Conversa', now(), 0)
    RETURNING id INTO v_conv_id;
  END IF;

  RETURN v_conv_id;
END $$;

-- 3) Trigger para garantir conversation_id em mensagens
CREATE OR REPLACE FUNCTION public.set_message_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.conversation_id IS NULL THEN
    NEW.conversation_id := public.get_or_create_conversation(NEW.sender_id, NEW.receiver_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_message_conversation ON public.messages;
CREATE TRIGGER trg_set_message_conversation
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.set_message_conversation();

-- 4) Atualizar dados da conversa quando chegar mensagem
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message = NEW.content,
      last_timestamp = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_update_conversation_on_message ON public.messages;
CREATE TRIGGER trg_update_conversation_on_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_on_message();

-- 5) Notificações: permitir inserts por funções com SECURITY DEFINER (postgres)
-- Mantém política de insert pelo próprio usuário e adiciona via definer
DROP POLICY IF EXISTS "Sistema pode criar notificações" ON public.notifications;
CREATE POLICY "Users can create own notifications"
ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Definer can insert notifications"
ON public.notifications
FOR INSERT
TO public
WITH CHECK (current_user = 'postgres');

-- 6) Função p/ notificar equipe Agrilink (admins/moderators)
CREATE OR REPLACE FUNCTION public.create_admin_notifications(p_type text, p_title text, p_message text, p_metadata jsonb DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  SELECT ur.user_id, p_type, p_title, p_message, p_metadata
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'moderator');
END $$;

-- 7) Atualizar funções de notificação para incluir equipe Agrilink
CREATE OR REPLACE FUNCTION public.notify_message_sent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sender_name TEXT;
  v_message_preview TEXT;
BEGIN
  SELECT full_name INTO v_sender_name
  FROM public.users
  WHERE id = NEW.sender_id;
  
  v_message_preview := substring(NEW.content from 1 for 50);
  IF length(NEW.content) > 50 THEN
    v_message_preview := v_message_preview || '...';
  END IF;
  
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

  PERFORM create_admin_notifications(
    'message',
    'Mensagem entre usuários',
    'Nova mensagem de ' || COALESCE(v_sender_name, 'Usuário'),
    jsonb_build_object(
      'message_id', NEW.id,
      'sender_id', NEW.sender_id,
      'receiver_id', NEW.receiver_id,
      'conversation_id', NEW.conversation_id
    )
  );
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_product_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM create_notification(
    NEW.user_id,
    'product',
    'Produto Publicado',
    'Seu produto "' || NEW.product_type || '" foi publicado com sucesso!',
    jsonb_build_object('product_id', NEW.id, 'product_type', NEW.product_type)
  );

  PERFORM create_admin_notifications(
    'product',
    'Produto Publicado',
    'Produto publicado por usuário',
    jsonb_build_object('product_id', NEW.id, 'user_id', NEW.user_id, 'product_type', NEW.product_type)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_product_updated()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status != OLD.status THEN
    PERFORM create_notification(
      NEW.user_id,
      'product',
      'Produto Atualizado',
      'Status do seu produto "' || NEW.product_type || '" foi alterado para: ' || NEW.status,
      jsonb_build_object('product_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
    );

    PERFORM create_admin_notifications(
      'product',
      'Produto Atualizado',
      'Status de produto alterado',
      jsonb_build_object('product_id', NEW.id, 'user_id', NEW.user_id, 'old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_transaction_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  PERFORM create_admin_notifications(
    'transaction',
    'Nova Transação',
    'Transação criada',
    jsonb_build_object('transaction_id', NEW.id, 'wallet_id', NEW.wallet_id, 'amount', NEW.amount, 'type', NEW.type)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_transaction_completed() 
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    PERFORM create_admin_notifications(
      'transaction',
      'Transação Completada',
      'Transação finalizada',
      jsonb_build_object('transaction_id', NEW.id, 'wallet_id', NEW.wallet_id, 'amount', NEW.amount, 'type', NEW.type)
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_support_message_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  PERFORM create_admin_notifications(
    'support',
    'Nova Mensagem de Suporte',
    'Mensagem de suporte registrada',
    jsonb_build_object('support_message_id', NEW.id, 'user_id', NEW.user_id)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_ficha_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  PERFORM create_admin_notifications(
    'ficha',
    'Ficha Criada',
    'Nova ficha de recebimento criada',
    jsonb_build_object(
      'ficha_id', NEW.id,
      'user_id', NEW.user_id,
      'nome_ficha', NEW.nome_ficha,
      'tipo_negocio', NEW.tipo_negocio,
      'produto', NEW.produto
    )
  );
  RETURN NEW;
END;
$function$;

-- 8) Realtime robusto
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 9) Tabela de inscrições Push (Web Push)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  device text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push subscriptions" ON public.push_subscriptions
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push subscriptions" ON public.push_subscriptions
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push subscriptions" ON public.push_subscriptions
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions" ON public.push_subscriptions
FOR DELETE USING (auth.uid() = user_id);

-- trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_push_subscriptions ON public.push_subscriptions;
CREATE TRIGGER trg_touch_push_subscriptions
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
