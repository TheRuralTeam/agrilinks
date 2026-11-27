-- Políticas para admins verem TODOS os produtos
CREATE POLICY "Admins podem ver todos os produtos" 
ON public.products 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Políticas para admins verem TODAS as notificações
CREATE POLICY "Admins podem ver todas as notificações" 
ON public.notifications 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Políticas para admins verem TODAS as transações
CREATE POLICY "Admins podem ver todas as transações" 
ON public.transactions 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Políticas para admins verem TODOS os pedidos
CREATE POLICY "Admins podem ver todos os pedidos" 
ON public.orders 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Políticas para admins verem TODOS os pre-orders
CREATE POLICY "Admins podem ver todos os pre-orders" 
ON public.pre_orders 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Políticas para admins verem TODAS as mensagens
CREATE POLICY "Admins podem ver todas as mensagens" 
ON public.messages 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Políticas para admins verem TODAS as conversas
CREATE POLICY "Admins podem ver todas as conversas" 
ON public.conversations 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Políticas para admins verem TODAS as comissões
CREATE POLICY "Admins podem ver todas as comissões" 
ON public.commissions 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Políticas para admins verem TODAS as carteiras
CREATE POLICY "Admins podem ver todas as carteiras" 
ON public.wallets 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Políticas para admins verem TODOS os likes
CREATE POLICY "Admins podem ver todos os likes" 
ON public.product_likes 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Políticas para admins verem TODOS os comentários
CREATE POLICY "Admins podem ver todos os comentários" 
ON public.product_comments 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Políticas para admins atualizarem pedidos
CREATE POLICY "Admins podem atualizar todos os pedidos" 
ON public.orders 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'));

-- Políticas para admins deletarem produtos
CREATE POLICY "Admins podem deletar todos os produtos" 
ON public.products 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'));