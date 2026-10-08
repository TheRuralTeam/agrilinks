-- RPC administrativa para enviar notificações com validação no servidor.
CREATE OR REPLACE FUNCTION public.admin_send_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_notification_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.is_root_admin(v_actor)
    OR public.is_super_root(v_actor)
    OR public.has_admin_permission(v_actor, 'manage_support'::public.admin_permission)
  ) THEN
    RAISE EXCEPTION 'Permission denied to send notifications' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL
     OR NULLIF(btrim(p_type), '') IS NULL
     OR length(btrim(p_type)) > 80
     OR NULLIF(btrim(p_title), '') IS NULL
     OR length(btrim(p_title)) > 120
     OR NULLIF(btrim(p_message), '') IS NULL
     OR length(btrim(p_message)) > 2000 THEN
    RAISE EXCEPTION 'Invalid notification data' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'Notification recipient not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.notifications(user_id, type, title, message, metadata)
  VALUES (p_user_id, btrim(p_type), btrim(p_title), btrim(p_message), COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_send_notification(uuid, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_send_notification(uuid, text, text, text, jsonb) TO authenticated;
