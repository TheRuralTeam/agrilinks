-- Corrigir as últimas funções sem search_path

CREATE OR REPLACE FUNCTION public.notify_transaction_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_transaction_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_support_message_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  RETURN NEW;
END;
$function$;

-- Habilitar RLS na tabela pre_orders (última tabela sem RLS)
ALTER TABLE public.pre_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver seus próprios pre-orders"
ON public.pre_orders
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios pre-orders"
ON public.pre_orders
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios pre-orders"
ON public.pre_orders
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios pre-orders"
ON public.pre_orders
FOR DELETE
USING (auth.uid() = user_id);