-- Adicionar política RLS para admins visualizarem todas as indicações
CREATE POLICY "Admins podem ver todas as indicações"
ON public.agent_referrals
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));