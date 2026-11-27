-- Criar trigger para sincronizar email_verified quando auth.users.email_confirmed_at mudar
-- NOTA: Este trigger precisa ser criado no schema auth, mas como não temos acesso direto,
-- vamos garantir que o fluxo funcione via código

-- Primeiro, vamos criar uma função que pode ser chamada para sincronizar o email
CREATE OR REPLACE FUNCTION public.sync_user_email_verified(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET email_verified = true,
      updated_at = NOW()
  WHERE id = p_user_id;
  
  RETURN true;
END;
$$;

-- Dar permissão para usuários autenticados chamarem esta função
GRANT EXECUTE ON FUNCTION public.sync_user_email_verified(UUID) TO authenticated;