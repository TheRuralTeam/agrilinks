CREATE TABLE IF NOT EXISTS public.admin_finance_viewers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_finance_viewers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_finance_viewers FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_agri_finance_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM auth.users AS au
    WHERE au.id = auth.uid()
      AND lower(au.email) = 'suporteagrilink@gmail.com'
      AND au.email_confirmed_at IS NOT NULL
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_view_agri_finance()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT public.is_agri_finance_owner()
    OR EXISTS (
      SELECT 1 FROM public.admin_finance_viewers AS viewer
      WHERE viewer.user_id = auth.uid()
    );
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_finance_access()
RETURNS TABLE(can_view boolean, can_manage_viewers boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT public.can_view_agri_finance(), public.is_agri_finance_owner();
$function$;

CREATE OR REPLACE FUNCTION public.list_admin_finance_viewers()
RETURNS TABLE(user_id uuid, full_name text, email text, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT public.is_agri_finance_owner() THEN
    RAISE EXCEPTION 'FINANCE_OWNER_REQUIRED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT au.id, coalesce(u.full_name, 'Utilizador'), au.email::text, viewer.created_at
  FROM public.admin_finance_viewers AS viewer
  JOIN auth.users AS au ON au.id = viewer.user_id
  LEFT JOIN public.users AS u ON u.id = au.id
  ORDER BY viewer.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_admin_finance_candidates()
RETURNS TABLE(user_id uuid, full_name text, email text, user_type text, is_viewer boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT public.is_agri_finance_owner() THEN
    RAISE EXCEPTION 'FINANCE_OWNER_REQUIRED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT au.id, coalesce(u.full_name, 'Utilizador'), au.email::text,
    coalesce(u.user_type::text, 'utilizador'),
    EXISTS (SELECT 1 FROM public.admin_finance_viewers AS viewer WHERE viewer.user_id = au.id)
  FROM auth.users AS au
  LEFT JOIN public.users AS u ON u.id = au.id
  WHERE au.id <> auth.uid() AND au.email_confirmed_at IS NOT NULL
  ORDER BY coalesce(u.full_name, au.email);
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_admin_finance_viewer(p_user_id uuid, p_enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT public.is_agri_finance_owner() THEN
    RAISE EXCEPTION 'FINANCE_OWNER_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_user_id = auth.uid() OR p_enabled IS NULL THEN
    RAISE EXCEPTION 'INVALID_FINANCE_VIEWER' USING ERRCODE = '22023';
  END IF;

  IF p_enabled THEN
    IF NOT EXISTS (
      SELECT 1 FROM auth.users AS au
      WHERE au.id = p_user_id AND au.email_confirmed_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'FINANCE_VIEWER_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    INSERT INTO public.admin_finance_viewers(user_id, granted_by)
    VALUES (p_user_id, auth.uid())
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    DELETE FROM public.admin_finance_viewers WHERE user_id = p_user_id;
  END IF;

  INSERT INTO public.audit_logs(event_type, action, user_id, details)
  VALUES (
    'ADMIN_FINANCE_ACCESS_CHANGED',
    CASE WHEN p_enabled THEN 'ADMIN_FINANCE_VIEWER_GRANTED' ELSE 'ADMIN_FINANCE_VIEWER_REVOKED' END,
    auth.uid(),
    jsonb_build_object('target_user_id', p_user_id)
  );
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_finance_user_names(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NOT public.can_view_agri_finance() THEN
    RAISE EXCEPTION 'FINANCE_ACCESS_REQUIRED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.id, coalesce(u.full_name, 'Utilizador')
  FROM public.users AS u
  WHERE u.id = ANY(coalesce(p_user_ids, ARRAY[]::uuid[]));
END;
$function$;

REVOKE ALL ON FUNCTION public.is_agri_finance_owner() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_agri_finance() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_finance_access() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_admin_finance_viewers() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_admin_finance_candidates() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_admin_finance_viewer(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_finance_user_names(uuid[]) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_agri_finance_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_agri_finance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_finance_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_admin_finance_viewers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_admin_finance_candidates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_finance_viewer(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_finance_user_names(uuid[]) TO authenticated;

DROP POLICY IF EXISTS "Administrators view marketplace commissions" ON public.commissions;
DROP POLICY IF EXISTS "Admins podem ver todas as comissões" ON public.commissions;
DROP POLICY IF EXISTS "Usuários podem ver suas comissões" ON public.commissions;
DROP POLICY IF EXISTS "Finance owner and delegated viewers can read commissions" ON public.commissions;
CREATE POLICY "Finance owner and delegated viewers can read commissions"
  ON public.commissions FOR SELECT TO authenticated
  USING (public.can_view_agri_finance());

REVOKE INSERT, UPDATE, DELETE ON public.commissions FROM anon, authenticated;
GRANT SELECT ON public.commissions TO authenticated;