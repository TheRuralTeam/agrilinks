-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261008125355; original ledger name: endurecer_mensagens_contra_idor_20261008.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

CREATE OR REPLACE FUNCTION public.send_message(
  p_sender uuid,
  p_receiver uuid,
  p_content text,
  p_files jsonb DEFAULT NULL::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  sender_conversation_id uuid;
  receiver_conversation_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF p_sender IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'SENDER_MISMATCH' USING ERRCODE = '42501';
  END IF;

  IF p_receiver IS NULL OR p_receiver = v_actor THEN
    RAISE EXCEPTION 'INVALID_RECIPIENT' USING ERRCODE = '22023';
  END IF;

  IF NULLIF(btrim(p_content), '') IS NULL THEN
    RAISE EXCEPTION 'MESSAGE_CONTENT_REQUIRED' USING ERRCODE = '22023';
  END IF;

  IF length(p_content) > 5000 THEN
    RAISE EXCEPTION 'MESSAGE_TOO_LONG' USING ERRCODE = '22001';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_receiver) THEN
    RAISE EXCEPTION 'RECIPIENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT id INTO sender_conversation_id
  FROM public.conversations
  WHERE user_id = v_actor AND peer_user_id = p_receiver
  LIMIT 1;

  IF sender_conversation_id IS NULL THEN
    INSERT INTO public.conversations (user_id, peer_user_id, last_message, last_timestamp)
    VALUES (v_actor, p_receiver, p_content, now())
    RETURNING id INTO sender_conversation_id;
  ELSE
    UPDATE public.conversations
    SET last_message = p_content, last_timestamp = now()
    WHERE id = sender_conversation_id;
  END IF;

  SELECT id INTO receiver_conversation_id
  FROM public.conversations
  WHERE user_id = p_receiver AND peer_user_id = v_actor
  LIMIT 1;

  IF receiver_conversation_id IS NULL THEN
    INSERT INTO public.conversations (user_id, peer_user_id, last_message, last_timestamp)
    VALUES (p_receiver, v_actor, p_content, now())
    RETURNING id INTO receiver_conversation_id;
  ELSE
    UPDATE public.conversations
    SET last_message = p_content, last_timestamp = now()
    WHERE id = receiver_conversation_id;
  END IF;

  INSERT INTO public.messages (
    conversation_id, sender_id, receiver_id, content, created_at, read, files
  ) VALUES (
    sender_conversation_id, v_actor, p_receiver, p_content, now(), false, p_files
  );

  RETURN sender_conversation_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_message(
  p_sender uuid,
  p_receiver uuid,
  p_conversation uuid,
  p_content text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_conversation public.conversations%rowtype;
  recip_conversation uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF p_sender IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'SENDER_MISMATCH' USING ERRCODE = '42501';
  END IF;

  IF p_receiver IS NULL OR p_receiver = v_actor THEN
    RAISE EXCEPTION 'INVALID_RECIPIENT' USING ERRCODE = '22023';
  END IF;

  IF NULLIF(btrim(p_content), '') IS NULL THEN
    RAISE EXCEPTION 'MESSAGE_CONTENT_REQUIRED' USING ERRCODE = '22023';
  END IF;

  IF length(p_content) > 5000 THEN
    RAISE EXCEPTION 'MESSAGE_TOO_LONG' USING ERRCODE = '22001';
  END IF;

  SELECT * INTO v_conversation
  FROM public.conversations
  WHERE id = p_conversation
    AND user_id = v_actor
    AND peer_user_id = p_receiver
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONVERSATION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, receiver_id, content, created_at)
  VALUES (p_conversation, v_actor, p_receiver, p_content, now());

  SELECT id INTO recip_conversation
  FROM public.conversations
  WHERE user_id = p_receiver AND peer_user_id = v_actor
  LIMIT 1;

  IF recip_conversation IS NULL THEN
    INSERT INTO public.conversations (
      user_id, peer_user_id, title, last_message, last_timestamp, unread_count
    )
    VALUES (
      p_receiver, v_actor,
      (SELECT full_name FROM public.users WHERE id = v_actor),
      p_content, now(), 1
    )
    RETURNING id INTO recip_conversation;
  ELSE
    UPDATE public.conversations
    SET last_message = p_content, last_timestamp = now(), unread_count = COALESCE(unread_count, 0) + 1
    WHERE id = recip_conversation;
  END IF;

  UPDATE public.conversations
  SET last_message = p_content, last_timestamp = now()
  WHERE id = p_conversation;
END;
$function$;
