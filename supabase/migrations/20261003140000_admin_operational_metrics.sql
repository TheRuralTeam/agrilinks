-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261003140000; original ledger name: admin_operational_metrics.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

CREATE OR REPLACE FUNCTION public.get_admin_operational_metrics()
RETURNS TABLE (
  metric_group text,
  status text,
  total_count bigint,
  created_last_30_days bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_admin_permission(
      auth.uid(),
      'view_analytics'::public.admin_permission
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorized to view admin operational metrics'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    'products'::text,
    COALESCE(product.status::text, 'unknown'),
    count(*),
    count(*) FILTER (WHERE product.created_at >= now() - interval '30 days')
  FROM public.products AS product
  GROUP BY COALESCE(product.status::text, 'unknown')

  UNION ALL

  SELECT
    'orders'::text,
    COALESCE(pre_order.status::text, 'unknown'),
    count(*),
    count(*) FILTER (WHERE pre_order.created_at >= now() - interval '30 days')
  FROM public.pre_orders AS pre_order
  GROUP BY COALESCE(pre_order.status::text, 'unknown')

  UNION ALL

  SELECT
    'transactions'::text,
    COALESCE(transaction.status::text, 'unknown')::text,
    count(*),
    count(*) FILTER (WHERE transaction.created_at >= now() - interval '30 days')
  FROM public.transactions AS transaction
  GROUP BY COALESCE(transaction.status::text, 'unknown')

  UNION ALL

  SELECT
    'freight_loads'::text,
    COALESCE(load.status::text, 'unknown'),
    count(*),
    count(*) FILTER (WHERE load.created_at >= now() - interval '30 days')
  FROM public.freight_loads AS load
  GROUP BY COALESCE(load.status::text, 'unknown');
END;
$function$;

REVOKE ALL ON FUNCTION public.get_admin_operational_metrics() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_admin_operational_metrics() TO authenticated, service_role;
