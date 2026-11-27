-- Keep the email outbox worker callable by the scheduled job only.
-- The shared secret is generated in Vault and never stored in source control.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'agrilink_email_outbox_worker'
  ) THEN
    PERFORM vault.create_secret(
      md5(gen_random_uuid()::text || gen_random_uuid()::text || clock_timestamp()::text)
      || md5(gen_random_uuid()::text || gen_random_uuid()::text || clock_timestamp()::text),
      'agrilink_email_outbox_worker',
      'Shared secret authorizing the scheduled email outbox worker',
      NULL
    );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.is_valid_email_outbox_worker_secret(p_candidate text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    p_candidate IS NOT NULL
    AND length(p_candidate) = 64
    AND EXISTS (
      SELECT 1
      FROM vault.decrypted_secrets AS s
      WHERE s.name = 'agrilink_email_outbox_worker'
        AND s.decrypted_secret = p_candidate
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_valid_email_outbox_worker_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_email_outbox_worker_secret(text) TO service_role;

DO $$
DECLARE
  v_job record;
  v_command text;
BEGIN
  SELECT jobid, command
    INTO v_job
  FROM cron.job
  WHERE jobname = 'email-outbox-every-minute'
  ORDER BY jobid
  LIMIT 1;

  IF FOUND AND position('x-worker-secret' IN v_job.command) = 0 THEN
    v_command := replace(
      v_job.command,
      $find$'), body :=$find$,
      $replace$', 'x-worker-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'agrilink_email_outbox_worker')), body :=$replace$
    );
    PERFORM cron.alter_job(v_job.jobid, command := v_command);
  END IF;
END
$$;
