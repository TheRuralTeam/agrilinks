-- Os códigos de verificação nunca devem ser acessíveis directamente pela API pública.
-- O envio e a validação são feitos exclusivamente pelas Edge Functions/RPC autorizadas.
DROP POLICY IF EXISTS "Allow insert for all" ON public.email_verification_codes;
DROP POLICY IF EXISTS "Allow read own codes" ON public.email_verification_codes;
DROP POLICY IF EXISTS "Allow update for verification" ON public.email_verification_codes;

REVOKE ALL PRIVILEGES ON TABLE public.email_verification_codes FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE public.email_verification_codes FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.email_verification_codes FROM authenticated;

COMMENT ON TABLE public.email_verification_codes IS
  'Códigos OTP privados. O acesso é reservado a operações privilegiadas do servidor; nunca expor os códigos pela Data API.';
