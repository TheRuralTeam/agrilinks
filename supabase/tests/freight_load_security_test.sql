-- Run with: supabase test db
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT extensions.plan(16);

SELECT extensions.ok(
  to_regclass('private.freight_load_qr_tokens') IS NOT NULL,
  'QR tokens are stored in a private table'
);

SELECT extensions.ok(
  NOT has_schema_privilege('anon', 'private', 'USAGE'),
  'anon cannot access the private schema'
);

SELECT extensions.ok(
  NOT has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated cannot access the private schema'
);

SELECT extensions.ok(
  NOT has_table_privilege('anon', 'private.freight_load_qr_tokens', 'SELECT'),
  'anon cannot read private QR tokens'
);

SELECT extensions.ok(
  NOT has_table_privilege('authenticated', 'private.freight_load_qr_tokens', 'SELECT'),
  'authenticated cannot read private QR tokens directly'
);

SELECT extensions.ok(
  has_table_privilege('authenticated', 'public.freight_loads', 'SELECT'),
  'authenticated can still read authorized freight-load rows'
);

SELECT extensions.ok(
  has_table_privilege('authenticated', 'public.freight_loads', 'INSERT'),
  'authenticated can still create freight loads'
);

SELECT extensions.ok(
  NOT has_table_privilege('anon', 'public.freight_loads', 'SELECT'),
  'anon cannot read freight loads'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'freight_loads'
      AND column_name = 'qr_token'
  ),
  'QR token is no longer a column of the exposed freight_loads table'
);

SELECT extensions.ok(
  has_function_privilege('authenticated', 'public.get_freight_load_qr_token(uuid)', 'EXECUTE'),
  'authenticated can call the authorized QR-token RPC'
);

SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.get_freight_load_qr_token(uuid)', 'EXECUTE'),
  'anon cannot call the QR-token RPC'
);

SELECT extensions.ok(
  has_function_privilege('authenticated', 'public.get_freight_load_qr_details(text)', 'EXECUTE'),
  'authenticated can call the authorized QR-details RPC'
);

SELECT extensions.ok(
  NOT has_function_privilege('anon', 'public.get_freight_load_qr_details(text)', 'EXECUTE'),
  'anon cannot call the QR-details RPC'
);

SELECT extensions.ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.freight_loads'::regclass
      AND tgname = 'freight_loads_create_private_qr_token'
      AND NOT tgisinternal
  ),
  'new freight loads receive a private QR token through a trigger'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND grantee IN ('anon', 'authenticated')
      AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES', 'MAINTAIN')
  ),
  'anon and authenticated have no dangerous table privileges in public'
);

SELECT extensions.ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_default_acl AS d
    JOIN pg_namespace AS n ON n.oid = d.defaclnamespace
    CROSS JOIN LATERAL aclexplode(d.defaclacl) AS acl
    WHERE d.defaclrole = 'postgres'::regrole
      AND n.nspname = 'public'
      AND acl.grantee IN ('anon'::regrole, 'authenticated'::regrole)
      AND acl.privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES', 'MAINTAIN')
  ),
  'new public tables created by postgres do not inherit dangerous privileges'
);

SELECT * FROM extensions.finish();
