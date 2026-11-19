-- Harden the outbox worker RPCs and remove one-time credentials after provider acceptance.
-- SECURITY DEFINER functions use an empty search_path and fully-qualified relations.

CREATE OR REPLACE FUNCTION public.claim_email_outbox(p_limit integer DEFAULT 25)
RETURNS SETOF public.email_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT e.id
    FROM public.email_outbox AS e
    WHERE (
      e.status = 'pending'
      AND e.scheduled_at <= pg_catalog.now()
      AND e.available_at <= pg_catalog.now()
    )
    OR (
      e.status = 'processing'
      AND e.locked_at < pg_catalog.now() - interval '2 minutes'
    )
    ORDER BY e.priority DESC, e.scheduled_at, e.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT greatest(1, least(p_limit, 100))
  )
  UPDATE public.email_outbox AS e
  SET status = 'processing',
      locked_at = pg_catalog.now(),
      attempts = e.attempts + 1,
      updated_at = pg_catalog.now()
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  affected_rows integer;
BEGIN
  IF p_id IS NULL OR p_provider_id IS NULL OR btrim(p_provider_id) = '' THEN
    RAISE EXCEPTION 'Invalid email outbox completion arguments';
  END IF;

  UPDATE public.email_outbox
  SET status = 'sent',
      provider_id = p_provider_id,
      sent_at = pg_catalog.now(),
      locked_at = NULL,
      payload = coalesce(payload, '{}'::jsonb)
        - 'otp_code'
        - 'token_hash'
        - 'access_token'
        - 'refresh_token'
        - 'password',
      updated_at = pg_catalog.now()
  WHERE id = p_id
    AND status = 'processing';

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION 'Email outbox job is not in processing state';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_email_outbox(
  p_id uuid,
  p_error text,
  p_retry boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.email_outbox
  SET status = CASE WHEN p_retry AND attempts < 8 THEN 'pending' ELSE 'failed' END,
      available_at = CASE
        WHEN p_retry AND attempts < 8
          THEN pg_catalog.now() + pg_catalog.make_interval(mins => least(1 << greatest(attempts - 1, 0), 30))
        ELSE available_at
      END,
      last_error = pg_catalog.left(p_error, 2000),
      locked_at = NULL,
      payload = CASE
        WHEN p_retry AND attempts < 8 THEN payload
        ELSE coalesce(payload, '{}'::jsonb)
          - 'otp_code'
          - 'token_hash'
          - 'access_token'
          - 'refresh_token'
          - 'password'
      END,
      updated_at = pg_catalog.now()
  WHERE id = p_id
    AND status = 'processing';
END;
$$;

CREATE OR REPLACE FUNCTION public.persist_email_outbox_auth_token(
  p_id uuid,
  p_token_hash text,
  p_verification_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $
DECLARE
  affected_rows integer;
BEGIN
  IF p_id IS NULL
    OR p_token_hash IS NULL
    OR btrim(p_token_hash) = ''
    OR p_verification_type NOT IN ('signup', 'invite', 'recovery', 'magiclink') THEN
    RAISE EXCEPTION 'Invalid email outbox auth token arguments';
  END IF;

  UPDATE public.email_outbox
  SET payload = coalesce(payload, '{}'::jsonb)
        || pg_catalog.jsonb_build_object(
          'token_hash', p_token_hash,
          'auth_type', p_verification_type
        ),
      updated_at = pg_catalog.now()
  WHERE id = p_id
    AND status = 'processing'
    AND template IN ('auth-signup', 'auth-recovery', 'auth-magic-link');

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION 'Email outbox auth job is not in processing state';
  END IF;
END;
$;

REVOKE ALL ON FUNCTION public.persist_email_outbox_auth_token(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_email_outbox_auth_token(uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.claim_email_outbox(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_outbox(integer) TO service_role;

REVOKE ALL ON FUNCTION public.fail_email_outbox(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_email_outbox(uuid, text, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.complete_email_outbox(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_email_outbox(uuid, text) TO service_role;
