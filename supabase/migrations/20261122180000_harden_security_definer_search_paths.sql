-- Harden SECURITY DEFINER functions that currently search public before the temporary schema.
-- pg_temp is explicitly placed last; public remains first and is not writable by API roles.
-- Function bodies, owners, signatures and EXECUTE grants are preserved.

DO $migration$
DECLARE
  target record;
  hardened_count integer := 0;
BEGIN
  FOR target IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments
    FROM pg_catalog.pg_proc AS p
    JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND COALESCE(p.proconfig, ARRAY[]::text[]) @> ARRAY['search_path=public']::text[]
    ORDER BY p.proname, p.oid
  LOOP
    EXECUTE pg_catalog.format(
      'ALTER FUNCTION %I.%I(%s) SET search_path TO public, pg_temp',
      target.schema_name,
      target.function_name,
      target.identity_arguments
    );
    hardened_count := hardened_count + 1;
  END LOOP;

  RAISE NOTICE 'Hardened % SECURITY DEFINER functions with search_path=public, pg_temp',
    hardened_count;
END;
$migration$;
