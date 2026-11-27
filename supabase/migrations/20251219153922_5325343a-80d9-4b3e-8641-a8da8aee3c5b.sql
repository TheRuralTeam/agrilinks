-- Tabela para pedidos especiais / AgriLink Sourcing
CREATE TABLE public.sourcing_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  delivery_date DATE NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sourcing_requests ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver seus próprios pedidos de sourcing"
ON public.sourcing_requests
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar pedidos de sourcing"
ON public.sourcing_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todos os pedidos de sourcing"
ON public.sourcing_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar pedidos de sourcing"
ON public.sourcing_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_sourcing_requests_updated_at
BEFORE UPDATE ON public.sourcing_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();