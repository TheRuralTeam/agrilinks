-- Remove one-time credentials from the durable queue immediately after provider acceptance.
-- The queue is service-role only; this further reduces the lifetime of sensitive values.
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
  SET status = 'sent',
      provider_id = p_provider_id,
      sent_at = now(),
      locked_at = NULL,
      payload = COALESCE(payload, '{}'::jsonb)
        - 'otp_code'
        - 'token_hash'
        - 'access_token'
        - 'refresh_token'
        - 'password',
      updated_at = now()
  WHERE id = p_id;
$$;

REVOKE ALL ON FUNCTION public.complete_email_outbox(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_email_outbox(uuid, text) TO service_role;
