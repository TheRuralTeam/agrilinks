-- Drop and recreate RLS policies as PERMISSIVE for fichas_recebimento SELECT
DROP POLICY IF EXISTS "Admins podem ver todas as fichas" ON public.fichas_recebimento;
DROP POLICY IF EXISTS "Usuários podem ver suas próprias fichas" ON public.fichas_recebimento;

CREATE POLICY "Admins podem ver todas as fichas" 
ON public.fichas_recebimento 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuários podem ver suas próprias fichas" 
ON public.fichas_recebimento 
FOR SELECT 
USING (auth.uid() = user_id);

-- Fix products SELECT policies
DROP POLICY IF EXISTS "Admins podem ver todos os produtos" ON public.products;
DROP POLICY IF EXISTS "Todos podem ver produtos ativos" ON public.products;

CREATE POLICY "Admins podem ver todos os produtos" 
ON public.products 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Todos podem ver produtos ativos" 
ON public.products 
FOR SELECT 
USING (status = 'active'::text);

-- Fix users SELECT policies to allow admins to see all users
DROP POLICY IF EXISTS "Admins podem ver todos os usuários" ON public.users;

CREATE POLICY "Admins podem ver todos os usuários" 
ON public.users 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix transactions SELECT policies
DROP POLICY IF EXISTS "Admins podem ver todas as transações" ON public.transactions;

CREATE POLICY "Admins podem ver todas as transações" 
ON public.transactions 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix notifications SELECT policies
DROP POLICY IF EXISTS "Admins podem ver todas as notificações" ON public.notifications;

CREATE POLICY "Admins podem ver todas as notificações" 
ON public.notifications 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix orders/pre_orders SELECT policies
DROP POLICY IF EXISTS "Admins podem ver todos os pedidos" ON public.orders;
DROP POLICY IF EXISTS "Admins podem ver todos os pre-orders" ON public.pre_orders;

CREATE POLICY "Admins podem ver todos os pedidos" 
ON public.orders 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem ver todos os pre-orders" 
ON public.pre_orders 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));