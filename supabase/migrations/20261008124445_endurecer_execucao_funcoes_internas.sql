-- Endurece funções internas: funções usadas exclusivamente por triggers/workers
-- não devem ser invocáveis por clientes anon/authenticated via RPC.

DO $$
DECLARE
  v record;
BEGIN
  FOR v IN
    SELECT DISTINCT n.nspname AS schema_name,
           p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS arguments
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE NOT t.tgisinternal
      AND n.nspname = 'public'
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, authenticated',
      v.schema_name, v.function_name, v.arguments
    );
  END LOOP;
END
$$;

-- Fluxo OTP legado: não está sendo usado pelo frontend atual.
REVOKE EXECUTE ON FUNCTION public.generate_email_otp(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_email_otp(text, text) FROM PUBLIC, anon, authenticated;

-- Rotinas de processamento da fila de e-mail são internas ao backend/worker.
REVOKE EXECUTE ON FUNCTION public.claim_email_outbox(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_email_outbox(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_email_outbox(uuid, text, boolean) FROM PUBLIC, anon, authenticated;

-- Rate limiter: somente backend privilegiado deve consumir buckets diretamente.
REVOKE EXECUTE ON FUNCTION public.consume_api_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(text, integer, integer) TO service_role;
