-- Harden authentication RPCs without changing their public signatures.

CREATE OR REPLACE FUNCTION public.sync_user_email_verified(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.users
  SET email_verified = true,
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.role() = 'service_role'
      OR (auth.uid() = _user_id AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
      ));
$$;

CREATE OR REPLACE FUNCTION public.is_root_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.role() = 'service_role'
      OR (auth.uid() = _user_id AND EXISTS (
        SELECT 1 FROM public.users
        WHERE id = _user_id AND is_root_admin = true
      ) AND public.has_role(_user_id, 'admin'));
$$;

CREATE OR REPLACE FUNCTION public.is_super_root(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.role() = 'service_role'
      OR (auth.uid() = _user_id AND EXISTS (
        SELECT 1 FROM public.users
        WHERE id = _user_id AND is_super_root = true AND is_root_admin = true
      ) AND public.has_role(_user_id, 'admin'));
$$;

CREATE OR REPLACE FUNCTION public.is_support_agent(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.role() = 'service_role'
      OR (auth.uid() = _user_id AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = 'support_agent'
      ));
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_email_confirmation(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_user_email_verified(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_root_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_root(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_support_agent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_agent_id_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_agent_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_email_verified(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_root_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_root(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_support_agent(uuid) TO authenticated, service_role;
