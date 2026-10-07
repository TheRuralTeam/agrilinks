-- Protege funções SECURITY DEFINER expostas pelo schema public.
-- Remove o acesso implícito de PUBLIC e libera anon apenas para fluxos públicos definidos.

DO $$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT n.nspname AS schema_name,
           p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC',
      v_function.schema_name,
      v_function.function_name,
      v_function.arguments
    );
  END LOOP;
END
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_contact(text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_email_otp(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_user_profile(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_agent_id_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_agent_code(text) TO anon;
