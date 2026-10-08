CREATE OR REPLACE FUNCTION public.register_push_subscription(
  p_endpoint text,
  p_auth_key text,
  p_p256dh_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'É necessário iniciar sessão para registar este dispositivo.'
      USING ERRCODE = '28000';
  END IF;

  IF p_endpoint IS NULL OR length(p_endpoint) < 40 OR length(p_endpoint) > 2048
     OR p_endpoint !~ '^https://'
     OR p_auth_key IS NULL OR length(p_auth_key) < 8 OR length(p_auth_key) > 256
     OR p_p256dh_key IS NULL OR length(p_p256dh_key) < 20 OR length(p_p256dh_key) > 256 THEN
    RAISE EXCEPTION 'Dados de subscrição push inválidos.'
      USING ERRCODE = '22023';
  END IF;

  -- Um endpoint identifica uma subscrição de navegador. Se o dispositivo mudar
  -- de conta, transfere-se apenas esse endpoint para a sessão autenticada actual.
  INSERT INTO public.push_subscriptions (
    user_id, endpoint, auth_key, p256dh_key, updated_at
  )
  VALUES (
    v_user_id, p_endpoint, p_auth_key, p_p256dh_key, now()
  )
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        auth_key = EXCLUDED.auth_key,
        p256dh_key = EXCLUDED.p256dh_key,
        updated_at = now();

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_subscription(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_subscription(text, text, text) TO authenticated;
