-- Criar tabela para rastrear sessões de trabalho dos assistentes
CREATE TABLE public.work_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_work_sessions_user_id ON public.work_sessions(user_id);
CREATE INDEX idx_work_sessions_active ON public.work_sessions(is_active) WHERE is_active = true;
CREATE INDEX idx_work_sessions_started_at ON public.work_sessions(started_at);

-- Enable RLS
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para work_sessions
CREATE POLICY "Assistentes podem ver suas próprias sessões"
ON public.work_sessions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Assistentes podem criar suas sessões"
ON public.work_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Assistentes podem atualizar suas sessões"
ON public.work_sessions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todas as sessões"
ON public.work_sessions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Criar tabela para rastrear entregas gerenciadas por assistentes
CREATE TABLE public.delivery_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    assistant_id UUID NOT NULL REFERENCES public.users(id),
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    pickup_at TIMESTAMP WITH TIME ZONE,
    in_transit_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'pickup', 'in_transit', 'delivered', 'cancelled')),
    notes TEXT,
    total_duration_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para delivery_tracking
CREATE INDEX idx_delivery_tracking_order_id ON public.delivery_tracking(order_id);
CREATE INDEX idx_delivery_tracking_assistant_id ON public.delivery_tracking(assistant_id);
CREATE INDEX idx_delivery_tracking_status ON public.delivery_tracking(status);

-- Enable RLS
ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para delivery_tracking
CREATE POLICY "Assistentes podem ver entregas atribuídas"
ON public.delivery_tracking
FOR SELECT
USING (
    auth.uid() = assistant_id 
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'support_agent'::app_role)
);

CREATE POLICY "Assistentes podem criar tracking de entrega"
ON public.delivery_tracking
FOR INSERT
WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'support_agent'::app_role)
);

CREATE POLICY "Assistentes podem atualizar suas entregas"
ON public.delivery_tracking
FOR UPDATE
USING (
    auth.uid() = assistant_id 
    OR has_role(auth.uid(), 'admin'::app_role)
);

-- Função para verificar se é assistente de atendimento
CREATE OR REPLACE FUNCTION public.is_support_agent(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'support_agent'
  )
$$;

-- Função para calcular tempo total trabalhado
CREATE OR REPLACE FUNCTION public.get_work_session_stats(p_user_id uuid, p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL)
RETURNS TABLE (
    total_sessions INTEGER,
    total_minutes INTEGER,
    avg_session_minutes NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_sessions,
        COALESCE(SUM(ws.duration_minutes), 0)::INTEGER as total_minutes,
        COALESCE(AVG(ws.duration_minutes), 0)::NUMERIC as avg_session_minutes
    FROM public.work_sessions ws
    WHERE ws.user_id = p_user_id
      AND ws.ended_at IS NOT NULL
      AND (p_start_date IS NULL OR ws.started_at::date >= p_start_date)
      AND (p_end_date IS NULL OR ws.started_at::date <= p_end_date);
END;
$$;

-- Trigger para calcular duração quando sessão termina
CREATE OR REPLACE FUNCTION public.calculate_session_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
        NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at)) / 60;
        NEW.is_active := false;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_calculate_session_duration
BEFORE UPDATE ON public.work_sessions
FOR EACH ROW
EXECUTE FUNCTION public.calculate_session_duration();

-- Trigger para calcular duração total de entrega
CREATE OR REPLACE FUNCTION public.calculate_delivery_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.delivered_at IS NOT NULL AND OLD.delivered_at IS NULL THEN
        NEW.total_duration_minutes := EXTRACT(EPOCH FROM (NEW.delivered_at - NEW.assigned_at)) / 60;
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_calculate_delivery_duration
BEFORE UPDATE ON public.delivery_tracking
FOR EACH ROW
EXECUTE FUNCTION public.calculate_delivery_duration();