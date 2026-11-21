-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20251114120307; original ledger name: (NULL).
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

-- Corrigir search_path para todas as funções restantes

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_type text, p_title text, p_message text, p_metadata jsonb DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_metadata)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_admin_notifications(p_type text, p_title text, p_message text, p_metadata jsonb DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  SELECT ur.user_id, p_type, p_title, p_message, p_metadata
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'moderator');
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.process_agent_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.referred_by_agent_id IS NOT NULL THEN
    INSERT INTO public.agent_referrals (agent_id, referred_user_id, points)
    VALUES (NEW.referred_by_agent_id, NEW.id, 10)
    ON CONFLICT (agent_id, referred_user_id) DO NOTHING;
    
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

  PERFORM create_admin_notifications(
    'support',
    'Nova Mensagem de Suporte',
    'Mensagem de suporte registrada',
    jsonb_build_object('support_message_id', NEW.id, 'user_id', NEW.user_id)
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(p_user_id uuid, p_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_message(p_sender uuid, p_receiver uuid, p_content text, p_files jsonb DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  sender_conversation_id uuid;
  receiver_conversation_id uuid;
begin
  select id into sender_conversation_id
  from conversations
  where user_id = p_sender and peer_user_id = p_receiver
  limit 1;

  if sender_conversation_id is null then
    insert into conversations (user_id, peer_user_id, last_message, last_timestamp)
    values (p_sender, p_receiver, p_content, now())
    returning id into sender_conversation_id;
  else
    update conversations
    set last_message = p_content, last_timestamp = now()
    where id = sender_conversation_id;
  end if;

  select id into receiver_conversation_id
  from conversations
  where user_id = p_receiver and peer_user_id = p_sender
  limit 1;

  if receiver_conversation_id is null then
    insert into conversations (user_id, peer_user_id, last_message, last_timestamp)
    values (p_receiver, p_sender, p_content, now())
    returning id into receiver_conversation_id;
  else
    update conversations
    set last_message = p_content, last_timestamp = now()
    where id = receiver_conversation_id;
  end if;

  insert into messages (
    conversation_id, sender_id, receiver_id, content, created_at, read, files
  ) values (
    sender_conversation_id, p_sender, p_receiver, p_content, now(), false, p_files
  );

  return sender_conversation_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.notify_message_sent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.notify_ficha_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.sync_email_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_type TEXT;
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL 
     AND (OLD.email_confirmed_at IS NULL OR NEW.email_confirmed_at <> OLD.email_confirmed_at) THEN
     
     SELECT user_type::TEXT
     INTO v_user_type
     FROM public.users
     WHERE email = NEW.email
     LIMIT 1;
     
     UPDATE public.users
     SET email_verified = true,
         updated_at = NOW()
     WHERE email = NEW.email;
     
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
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
    CASE 
      WHEN NEW.email_confirmed_at IS NOT NULL THEN true
      ELSE false
    END,
    false
  );
  
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
$function$;

CREATE OR REPLACE FUNCTION public.assign_agent_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.user_type = 'agente' AND NEW.agent_code IS NULL THEN
    NEW.agent_code := generate_agent_code();
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_agent_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    
    SELECT EXISTS(SELECT 1 FROM users WHERE agent_code = new_code) INTO code_exists;
    
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$function$;
