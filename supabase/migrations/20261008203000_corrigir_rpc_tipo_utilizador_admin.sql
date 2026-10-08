-- Corrige a RPC administrativa usada pelo painel para alterar o tipo de utilizador.
-- O bug original vinha do parâmetro implícito "id" criado por RETURNS TABLE,
-- que entrava em conflito com "WHERE id = p_user_id" dentro do UPDATE.

CREATE OR REPLACE FUNCTION public.admin_set_user_type(
  p_user_id uuid,
  p_user_type public.user_type_enum
)
RETURNS TABLE(
  id uuid,
  full_name text,
  user_type public.user_type_enum,
  agent_code text,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_old public.user_type_enum;
  v_new public.user_type_enum := p_user_type;
  v_agent_code text;
BEGIN
  IF v_actor IS NULL OR NOT (
    public.is_root_admin(v_actor)
    OR public.is_super_root(v_actor)
    OR public.has_admin_permission(v_actor, 'manage_users'::public.admin_permission)
  ) THEN
    RAISE EXCEPTION 'Permission denied to change user type' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL OR p_user_type IS NULL THEN
    RAISE EXCEPTION 'User and user type are required' USING ERRCODE = '22023';
  END IF;

  SELECT u.user_type
  INTO v_old
  FROM public.users AS u
  WHERE u.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_old IS NOT DISTINCT FROM v_new THEN
    RETURN QUERY
      SELECT u.id, u.full_name, u.user_type, u.agent_code, u.updated_at
      FROM public.users AS u
      WHERE u.id = p_user_id;
    RETURN;
  END IF;

  IF v_new = 'agente' AND EXISTS (
    SELECT 1
    FROM public.user_roles AS ur
    WHERE ur.user_id = p_user_id
      AND ur.role IN ('admin'::public.app_role, 'support_agent'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'An administrator/support account cannot be converted to an operational agent'
      USING ERRCODE = '42501';
  END IF;

  IF v_new = 'agente' THEN
    SELECT u.agent_code
    INTO v_agent_code
    FROM public.users AS u
    WHERE u.id = p_user_id;

    IF NULLIF(btrim(v_agent_code), '') IS NULL THEN
      v_agent_code := public.generate_agent_code();
    END IF;
  END IF;

  UPDATE public.users AS u
  SET
    user_type = v_new,
    agent_code = CASE
      WHEN v_new = 'agente' THEN v_agent_code
      ELSE u.agent_code
    END,
    updated_at = now()
  WHERE u.id = p_user_id;

  INSERT INTO public.audit_logs (event_type, action, user_id, details)
  VALUES (
    'USER_TYPE_CHANGED',
    'ADMIN_USER_TYPE_CHANGED',
    v_actor,
    jsonb_build_object(
      'target_user_id', p_user_id,
      'previous_user_type', v_old,
      'new_user_type', v_new
    )
  );

  RETURN QUERY
    SELECT u.id, u.full_name, u.user_type, u.agent_code, u.updated_at
    FROM public.users AS u
    WHERE u.id = p_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_user_type(uuid,public.user_type_enum) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_type(uuid,public.user_type_enum) TO authenticated;
