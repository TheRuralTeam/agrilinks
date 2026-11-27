-- Adicionar campo de código de agente e referência na tabela users
ALTER TABLE public.users 
ADD COLUMN agent_code TEXT UNIQUE,
ADD COLUMN referred_by_agent_id UUID REFERENCES public.users(id);

-- Criar índice para performance
CREATE INDEX idx_users_agent_code ON public.users(agent_code);
CREATE INDEX idx_users_referred_by ON public.users(referred_by_agent_id);

-- Criar tabela para rastrear indicações e pontos dos agentes
CREATE TABLE public.agent_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(agent_id, referred_user_id)
);

-- Habilitar RLS
ALTER TABLE public.agent_referrals ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para agent_referrals
CREATE POLICY "Agentes podem ver suas indicações"
ON public.agent_referrals
FOR SELECT
USING (auth.uid() = agent_id);

CREATE POLICY "Sistema pode criar indicações"
ON public.agent_referrals
FOR INSERT
WITH CHECK (true);

-- Função para gerar código único de agente (6 caracteres alfanuméricos)
CREATE OR REPLACE FUNCTION public.generate_agent_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Gerar código de 6 caracteres (letras maiúsculas e números)
    new_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    
    -- Verificar se já existe
    SELECT EXISTS(SELECT 1 FROM users WHERE agent_code = new_code) INTO code_exists;
    
    -- Se não existe, retornar
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$;

-- Trigger para gerar código automaticamente quando usuário é agente
CREATE OR REPLACE FUNCTION public.assign_agent_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se é agente e não tem código, gerar um
  IF NEW.user_type = 'agente' AND NEW.agent_code IS NULL THEN
    NEW.agent_code := generate_agent_code();
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER assign_agent_code_trigger
BEFORE INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.assign_agent_code();

-- Trigger para adicionar pontos quando alguém é indicado
CREATE OR REPLACE FUNCTION public.process_agent_referral()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se foi indicado por um agente, criar registro de indicação
  IF NEW.referred_by_agent_id IS NOT NULL THEN
    INSERT INTO public.agent_referrals (agent_id, referred_user_id, points)
    VALUES (NEW.referred_by_agent_id, NEW.id, 10)
    ON CONFLICT (agent_id, referred_user_id) DO NOTHING;
    
    -- Criar notificação para o agente
    PERFORM create_notification(
      NEW.referred_by_agent_id,
      'referral',
      'Nova Indicação!',
      'Você ganhou 10 pontos por indicar ' || NEW.full_name || '!',
      jsonb_build_object(
        'referred_user_id', NEW.id,
        'referred_user_name', NEW.full_name,
        'points', 10
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER process_agent_referral_trigger
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.process_agent_referral();

-- Função para obter estatísticas de indicações do agente
CREATE OR REPLACE FUNCTION public.get_agent_referral_stats(agent_user_id UUID)
RETURNS TABLE(
  total_referrals BIGINT,
  total_points BIGINT,
  recent_referrals JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_referrals,
    COALESCE(SUM(points), 0)::BIGINT as total_points,
    jsonb_agg(
      jsonb_build_object(
        'user_name', u.full_name,
        'user_type', u.user_type,
        'points', ar.points,
        'created_at', ar.created_at
      )
      ORDER BY ar.created_at DESC
    ) FILTER (WHERE ar.id IS NOT NULL) as recent_referrals
  FROM public.agent_referrals ar
  LEFT JOIN public.users u ON u.id = ar.referred_user_id
  WHERE ar.agent_id = agent_user_id;
END;
$$;