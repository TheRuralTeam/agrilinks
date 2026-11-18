-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20251112093333; original ledger name: (NULL).
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

-- Fix function search path warnings
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(p_user_id uuid, p_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.set_message_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.conversation_id IS NULL THEN
    NEW.conversation_id := public.get_or_create_conversation(NEW.sender_id, NEW.receiver_id);
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message = NEW.content,
      last_timestamp = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.create_admin_notifications(p_type text, p_title text, p_message text, p_metadata jsonb DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  SELECT ur.user_id, p_type, p_title, p_message, p_metadata
  FROM public.user_roles ur
  WHERE ur.role IN ('admin', 'moderator');
END $$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;
