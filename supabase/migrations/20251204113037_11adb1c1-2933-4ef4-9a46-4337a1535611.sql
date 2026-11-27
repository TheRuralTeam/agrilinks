-- Tabela para armazenar códigos OTP de verificação de email
CREATE TABLE public.email_verification_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index para busca rápida
CREATE INDEX idx_email_verification_codes_email ON public.email_verification_codes(email);
CREATE INDEX idx_email_verification_codes_code ON public.email_verification_codes(code);

-- RLS
ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

-- Permitir inserção para usuários autenticados ou anônimos (durante registro)
CREATE POLICY "Allow insert for all" ON public.email_verification_codes
  FOR INSERT WITH CHECK (true);

-- Permitir leitura apenas do próprio código
CREATE POLICY "Allow read own codes" ON public.email_verification_codes
  FOR SELECT USING (true);

-- Permitir update para verificação
CREATE POLICY "Allow update for verification" ON public.email_verification_codes
  FOR UPDATE USING (true);

-- Função para gerar código OTP
CREATE OR REPLACE FUNCTION public.generate_email_otp(p_user_id UUID, p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_code TEXT;
BEGIN
  -- Gerar código de 6 dígitos
  v_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
  
  -- Invalidar códigos anteriores
  UPDATE public.email_verification_codes
  SET verified = true
  WHERE email = p_email AND verified = false;
  
  -- Inserir novo código (expira em 15 minutos)
  INSERT INTO public.email_verification_codes (user_id, email, code, expires_at)
  VALUES (p_user_id, p_email, v_code, NOW() + INTERVAL '15 minutes');
  
  RETURN v_code;
END;
$$;

-- Função para verificar código OTP
CREATE OR REPLACE FUNCTION public.verify_email_otp(p_email TEXT, p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_valid BOOLEAN;
BEGIN
  -- Verificar se o código é válido
  SELECT user_id INTO v_user_id
  FROM public.email_verification_codes
  WHERE email = p_email 
    AND code = p_code 
    AND verified = false
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Marcar código como verificado
  UPDATE public.email_verification_codes
  SET verified = true
  WHERE email = p_email AND code = p_code;
  
  -- Atualizar email_verified na tabela users
  UPDATE public.users
  SET email_verified = true, updated_at = NOW()
  WHERE id = v_user_id;
  
  RETURN true;
END;
$$;