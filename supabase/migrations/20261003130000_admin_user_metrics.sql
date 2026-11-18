-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261003130000; original ledger name: admin_user_metrics.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

CREATE OR REPLACE FUNCTION public.get_admin_user_metrics()
RETURNS TABLE (
  user_type text,
  user_count bigint,
  verified_count bigint,
  registered_last_30_days bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    EXISTS (
      SELECT 1
      FROM public.user_roles AS role
      WHERE role.user_id = auth.uid()
        AND role.role = 'admin'::public.app_role
    )
    OR EXISTS (
      SELECT 1
      FROM public.admin_permissions AS permission
      WHERE permission.user_id = auth.uid()
        AND permission.permission IN (
          'view_analytics'::public.admin_permission,
          'manage_users'::public.admin_permission
        )
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to view admin user metrics'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH role_types(user_type, sort_order) AS (
    VALUES
      ('agricultor'::text, 1),
      ('comprador'::text, 2),
      ('agente'::text, 3),
      ('motorista'::text, 4),
      ('outros'::text, 5)
  )
  SELECT
    role_types.user_type,
    count(users.id),
    count(users.id) FILTER (WHERE users.verified),
    count(users.id) FILTER (
      WHERE users.created_at >= now() - interval '30 days'
    )
  FROM role_types
  LEFT JOIN public.users AS users
    ON (
      role_types.user_type = 'outros'
      AND users.user_type IS NULL
    )
    OR (
      role_types.user_type <> 'outros'
      AND users.user_type::text = role_types.user_type
    )
  GROUP BY role_types.user_type, role_types.sort_order
  ORDER BY role_types.sort_order;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_admin_user_metrics() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_admin_user_metrics() TO authenticated, service_role;
