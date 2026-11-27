CREATE TABLE IF NOT EXISTS public.email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL UNIQUE,
  recipient text NOT NULL,
  subject text NOT NULL,
  template text NOT NULL DEFAULT 'notification',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  sent_at timestamptz,
  provider_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_outbox_pending_idx
  ON public.email_outbox (available_at, created_at)
  WHERE status IN ('pending', 'processing');

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enqueue_notification_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email FROM public.users WHERE id = NEW.user_id;

  IF v_email IS NOT NULL AND btrim(v_email) <> '' THEN
    INSERT INTO public.email_outbox (dedupe_key, recipient, subject, payload)
    VALUES (
      'notification:' || NEW.id::text,
      lower(btrim(v_email)),
      NEW.title,
      jsonb_build_object(
        'full_name', (SELECT full_name FROM public.users WHERE id = NEW.user_id),
        'title', NEW.title,
        'message', NEW.message,
        'notification_id', NEW.id,
        'metadata', COALESCE(NEW.metadata, '{}'::jsonb)
      )
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enqueue_notification_email_trigger ON public.notifications;
CREATE TRIGGER enqueue_notification_email_trigger
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.enqueue_notification_email();

CREATE OR REPLACE FUNCTION public.claim_email_outbox(p_limit integer DEFAULT 25)
RETURNS SETOF public.email_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id
    FROM public.email_outbox
    WHERE (status = 'pending' AND available_at <= now())
       OR (status = 'processing' AND locked_at < now() - interval '2 minutes')
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(p_limit, 100))
  )
  UPDATE public.email_outbox e
  SET status = 'processing', locked_at = now(), attempts = attempts + 1, updated_at = now()
  FROM claimed
  WHERE e.id = claimed.id
  RETURNING e.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_email_outbox(
  p_id uuid,
  p_provider_id text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.email_outbox
  SET status = 'sent', provider_id = p_provider_id, sent_at = now(), locked_at = NULL, updated_at = now()
  WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION public.fail_email_outbox(
  p_id uuid,
  p_error text,
  p_retry boolean DEFAULT true
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.email_outbox
  SET status = CASE WHEN p_retry AND attempts < 8 THEN 'pending' ELSE 'failed' END,
      available_at = CASE WHEN p_retry AND attempts < 8 THEN now() + make_interval(mins => least(1 << greatest(attempts - 1, 0), 30)) ELSE available_at END,
      last_error = left(p_error, 2000), locked_at = NULL, updated_at = now()
  WHERE id = p_id;
$$;

REVOKE ALL ON public.email_outbox FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_outbox(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_email_outbox(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_email_outbox(uuid, text, boolean) TO service_role;