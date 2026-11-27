-- Permitir que assistentes de atendimento vejam todos os pedidos
CREATE POLICY "Assistentes podem ver todos os pedidos" 
ON public.orders 
FOR SELECT 
USING (is_support_agent(auth.uid()));

-- Permitir que assistentes de atendimento atualizem status dos pedidos
CREATE POLICY "Assistentes podem atualizar status dos pedidos" 
ON public.orders 
FOR UPDATE 
USING (is_support_agent(auth.uid()));

-- Permitir que assistentes de atendimento vejam todos os pre-orders
CREATE POLICY "Assistentes podem ver todos os pre-orders" 
ON public.pre_orders 
FOR SELECT 
USING (is_support_agent(auth.uid()));

-- Permitir que assistentes de atendimento atualizem status dos pre-orders
CREATE POLICY "Assistentes podem atualizar status dos pre-orders" 
ON public.pre_orders 
FOR UPDATE 
USING (is_support_agent(auth.uid()));

-- Permitir que assistentes vejam produtos para associar aos pedidos
CREATE POLICY "Assistentes podem ver todos os produtos" 
ON public.products 
FOR SELECT 
USING (is_support_agent(auth.uid()));

-- Permitir que assistentes vejam informações básicas dos usuários para entregas
CREATE POLICY "Assistentes podem ver usuários para entregas" 
ON public.users 
FOR SELECT 
USING (is_support_agent(auth.uid()));