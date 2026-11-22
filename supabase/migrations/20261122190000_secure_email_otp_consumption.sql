-- Atomically consume a single-use email OTP before confirming the Auth user.
-- New OTPs are stored as SHA-256 hashes; the legacy plaintext parameter is temporary
-- compatibility for codes issued before this migration and expires with those codes.

CREATE OR REPLACE FUNCTION public.consume_email_verification_code(
  p_email text,
  p_code_hash text,
  p_legacy_code text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  IF p_email IS NULL
    OR length(btrim(p_email)) = 0
    OR p_code_hash IS NULL
    OR p_code_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN NULL;
  END IF;

  UPDATE public.email_verification_codes AS code_row
  SET verified = TRUE
  WHERE code_row.id = (
    SELECT candidate.id
    FROM public.email_verification_codes AS candidate
    WHERE lower(candidate.email) = lower(btrim(p_email))
      AND candidate.verified IS NOT TRUE
      AND candidate.expires_at > pg_catalog.now()
      AND (
        candidate.code = p_code_hash
        OR (p_legacy_code IS NOT NULL AND candidate.code = p_legacy_code)
      )
    ORDER BY candidate.created_at DESC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING code_row.user_id INTO v_user_id;

  RETURN v_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_email_verification_code(text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_email_verification_code(text, text, text)
  TO service_role;
