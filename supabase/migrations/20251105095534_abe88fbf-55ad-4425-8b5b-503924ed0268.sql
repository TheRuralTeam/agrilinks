-- Corrigir problemas de segurança: habilitar RLS e criar políticas nas tabelas expostas

-- 1) Tabela audit_logs: apenas admins ou sistema podem ver/inserir
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 2) Tabela fichas_recebimento: usuários veem apenas suas fichas
ALTER TABLE public.fichas_recebimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver suas próprias fichas"
ON public.fichas_recebimento
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir suas próprias fichas"
ON public.fichas_recebimento
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias fichas"
ON public.fichas_recebimento
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias fichas"
ON public.fichas_recebimento
FOR DELETE
USING (auth.uid() = user_id);

-- 3) Tabela messages: usuários veem mensagens onde são remetente ou destinatário
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver mensagens enviadas ou recebidas"
ON public.messages
FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Usuários podem inserir mensagens como remetente"
ON public.messages
FOR INSERT
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Usuários podem atualizar mensagens recebidas (marcar lida)"
ON public.messages
FOR UPDATE
USING (auth.uid() = receiver_id);

-- 4) Corrigir search_path nas funções vulneráveis
CREATE OR REPLACE FUNCTION public.notify_product_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.notify_product_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_agent_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Se foi indicado por um agente, criar registro de indicação
  IF NEW.referred_by_agent_id IS NOT NULL THEN
    INSERT INTO public.agent_referrals (agent_id, referred_user_id, points)
    VALUES (NEW.referred_by_agent_id, NEW.id, 10)
    ON CONFLICT (agent_id, referred_user_id) DO NOTHING;
    
    -- Criar notificação para o agente
    PERFORM create_notification(
      NEW.referred_by_agent_id,
      'referral',
      'Nova Indicação!',
      'Você ganhou 10 pontos por indicar ' || NEW.full_name || '!',
      jsonb_build_object(
        'referred_user_id', NEW.id,
        'referred_user_name', NEW.full_name,
        'points', 10
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;