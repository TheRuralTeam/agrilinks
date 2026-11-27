-- AgriLink notification delivery hardening.
-- Durable Web Push queue, secure one-time dispatch tokens, acceptance-email dedupe,
-- and admin-only user type changes.

CREATE TABLE IF NOT EXISTS public.notification_push_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL UNIQUE REFERENCES public.notifications(id) ON DELETE CASCADE,
  dispatch_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','dispatched','failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  dispatched_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_push_queue_dispatch_idx
ON public.notification_push_queue(status,next_attempt_at,created_at)
WHERE status IN ('pending','processing');

ALTER TABLE public.notification_push_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_push_queue FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  INSERT INTO public.notification_push_queue(notification_id)
  VALUES(NEW.id)
  ON CONFLICT(notification_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enqueue_notification_push_trigger ON public.notifications;
CREATE TRIGGER enqueue_notification_push_trigger
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.enqueue_notification_push();

CREATE OR REPLACE FUNCTION public.claim_notification_push_queue(p_limit integer DEFAULT 25)
RETURNS SETOF public.notification_push_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT q.id
    FROM public.notification_push_queue q
    WHERE (q.status='pending' AND q.next_attempt_at<=now())
       OR (q.status='processing' AND q.locked_at<now()-interval '2 minutes')
    ORDER BY q.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1,least(p_limit,100))
  )
  UPDATE public.notification_push_queue q
  SET status='processing',locked_at=now(),attempts=q.attempts+1,updated_at=now()
  FROM claimed c
  WHERE q.id=c.id
  RETURNING q.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_notification_push_queue(p_id uuid,p_error text,p_retry boolean DEFAULT true)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path=public
AS $$
  UPDATE public.notification_push_queue
  SET status=CASE WHEN p_retry AND attempts<8 THEN 'pending' ELSE 'failed' END,
      next_attempt_at=CASE WHEN p_retry AND attempts<8 THEN now()+make_interval(mins=>least(1<<greatest(attempts-1,0),30)) ELSE next_attempt_at END,
      last_error=left(p_error,2000),
      locked_at=NULL,
      updated_at=now()
  WHERE id=p_id;
$$;

CREATE OR REPLACE FUNCTION public.complete_notification_push_queue(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path=public
AS $$
  UPDATE public.notification_push_queue
  SET status='dispatched',dispatched_at=now(),locked_at=NULL,updated_at=now()
  WHERE id=p_id;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_push_queue(integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.fail_notification_push_queue(uuid,text,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.complete_notification_push_queue(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_push_queue(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_notification_push_queue(uuid,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_notification_push_queue(uuid) TO service_role;

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

CREATE OR REPLACE FUNCTION public.enqueue_notification_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_email text;
BEGIN
  IF NEW.type='pre_order_accepted' THEN
    RETURN NEW;
  END IF;
  SELECT email INTO v_email FROM public.users WHERE id=NEW.user_id;
  IF v_email IS NOT NULL AND btrim(v_email)<>'' THEN
    INSERT INTO public.email_outbox(dedupe_key,recipient,subject,payload)
    VALUES(
      'notification:'||NEW.id::text,
      lower(btrim(v_email)),
      NEW.title,
      jsonb_build_object(
        'full_name',(SELECT full_name FROM public.users WHERE id=NEW.user_id),
        'title',NEW.title,'message',NEW.message,'notification_id',NEW.id,'metadata',COALESCE(NEW.metadata,'{}'::jsonb)
      )
    ) ON CONFLICT(dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_user_type_admin_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE v_actor uuid:=auth.uid();
BEGIN
  IF NEW.user_type IS DISTINCT FROM OLD.user_type THEN
    IF v_actor IS NULL OR NOT (
      public.is_root_admin(v_actor) OR public.is_super_root(v_actor) OR
      public.has_admin_permission(v_actor,'manage_users'::public.admin_permission)
    ) THEN
      RAISE EXCEPTION 'USER_TYPE_ADMIN_ONLY: apenas um administrador pode alterar o tipo de utilizador'
        USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_user_type_admin_change ON public.users;
CREATE TRIGGER trg_enforce_user_type_admin_change
BEFORE UPDATE OF user_type ON public.users
FOR EACH ROW EXECUTE FUNCTION public.enforce_user_type_admin_change();

REVOKE ALL ON FUNCTION public.enqueue_notification_push() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_notification_push() TO authenticated;
REVOKE ALL ON FUNCTION public.enforce_user_type_admin_change() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_user_type_admin_change() TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.schedule(
      'agrilink-dispatch-notification-push',
      '* * * * *',
      'SELECT public.dispatch_notification_push_queue()'
    );
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
