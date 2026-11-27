-- Mensagens privadas notificam apenas o destinatário da conversa.
-- A equipa administrativa não deve receber uma cópia de cada mensagem privada.
CREATE OR REPLACE FUNCTION public.notify_message_sent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_sender_name text;
  v_message_preview text;
BEGIN
  SELECT full_name INTO v_sender_name
  FROM public.users
  WHERE id = NEW.sender_id;

  v_message_preview := substring(NEW.content from 1 for 50);
  IF length(NEW.content) > 50 THEN
    v_message_preview := v_message_preview || '...';
  END IF;

  PERFORM public.create_notification(
    NEW.receiver_id,
    'message',
    'Nova Mensagem de ' || COALESCE(v_sender_name, 'Utilizador'),
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
$function$;

REVOKE ALL ON FUNCTION public.notify_message_sent() FROM PUBLIC, anon, authenticated;
