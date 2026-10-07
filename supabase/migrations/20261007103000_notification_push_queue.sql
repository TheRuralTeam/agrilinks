-- Requeue bridge for automatic Web Push delivery through pg_net.
CREATE OR REPLACE FUNCTION public.dispatch_notification_push_queue(p_limit integer DEFAULT 25)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_queue public.notification_push_queue%ROWTYPE;
  v_sent integer:=0;
BEGIN
  FOR v_queue IN SELECT * FROM public.claim_notification_push_queue(p_limit)
  LOOP
    PERFORM net.http_post(
      url := 'https://oqcrfqtlfqwrxxmsjpaf.supabase.co/functions/v1/dispatch-push-notification',
      body := jsonb_build_object('queue_id',v_queue.id,'dispatch_token',v_queue.dispatch_token),
      params := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type','application/json'),
      timeout_milliseconds := 5000
    );
    v_sent:=v_sent+1;
  END LOOP;
  RETURN v_sent;
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_notification_push_queue(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_notification_push_queue(integer) TO service_role;
