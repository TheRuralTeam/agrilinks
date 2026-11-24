DROP POLICY IF EXISTS "Utilizadores podem ler as próprias notificações" ON public.notifications;

CREATE POLICY "Utilizadores podem ler as próprias notificações"
ON public.notifications
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END;
$$;
