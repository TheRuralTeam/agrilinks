-- Adicionar campos de verificação de telefone
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_code VARCHAR(6),
ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMPTZ;

-- Índice para buscar por código de verificação
CREATE INDEX IF NOT EXISTS idx_users_verification_code ON public.users(verification_code);