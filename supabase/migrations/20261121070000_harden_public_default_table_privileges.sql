-- Remove privileges that application clients must never need on public tables.
-- RLS does not protect TRUNCATE, and clients should not be able to create triggers,
-- create foreign-key references, or run table maintenance operations.

BEGIN;

DO $$
DECLARE
  v_table record;
BEGIN
  FOR v_table IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON TABLE %I.%I FROM anon, authenticated',
      v_table.schemaname,
      v_table.tablename
    );
  END LOOP;
END;
$$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES, MAINTAIN ON TABLES FROM anon, authenticated;

-- Application tables are owned by postgres; platform-managed supabase_admin defaults are left untouched.

DO $$
DECLARE
  v_remaining integer;
BEGIN
  SELECT count(*)::integer
    INTO v_remaining
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES', 'MAINTAIN');

  IF v_remaining <> 0 THEN
    RAISE EXCEPTION
      'Dangerous table privileges remain for anon/authenticated on % public table grants',
      v_remaining;
  END IF;
END;
$$;

COMMIT;
