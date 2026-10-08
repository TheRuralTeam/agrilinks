-- Restringe a gestão de subscrições push ao utilizador autenticado proprietário.
-- O service_role continua a poder gerir registos através do bypass de RLS.
DROP POLICY IF EXISTS "Sistema pode gerenciar subscrições" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Usuários podem gerenciar suas subscrições" ON public.push_subscriptions;

CREATE POLICY "Utilizadores gerem apenas as próprias subscrições push"
ON public.push_subscriptions
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- Impede alterações de propriedade das notificações durante a marcação como lida.
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias notificações" ON public.notifications;
CREATE POLICY "Utilizadores actualizam apenas as próprias notificações"
ON public.notifications
FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);
