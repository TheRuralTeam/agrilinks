BEGIN;
REVOKE ALL ON TABLE public.freight_pricing_settings FROM anon, authenticated;

DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.freight_pricing_settings', 'SELECT')
     OR has_table_privilege('anon', 'public.freight_pricing_settings', 'SELECT') THEN
    RAISE EXCEPTION 'Direct API-role access to freight_pricing_settings remains';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.get_freight_pricing_settings()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated RPC access to freight pricing settings was unexpectedly removed';
  END IF;
END;
$$;
COMMIT;