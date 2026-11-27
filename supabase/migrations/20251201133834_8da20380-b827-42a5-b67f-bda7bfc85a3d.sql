-- Habilitar RLS na tabela push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy para usuários gerenciarem suas próprias subscrições
CREATE POLICY "Usuários podem gerenciar suas subscrições"
ON public.push_subscriptions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy para o sistema inserir/atualizar subscrições
CREATE POLICY "Sistema pode gerenciar subscrições"
ON public.push_subscriptions
FOR ALL
USING (true)
WITH CHECK (true);