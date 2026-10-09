-- A rate-limited validation function writes to api_rate_limits and must be VOLATILE.
CREATE OR REPLACE FUNCTION public.validate_agent_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headers jsonb;
  v_ip text;
  v_bucket text;
  v_now timestamptz := now();
  v_count integer;
BEGIN
  IF p_code IS NULL OR p_code !~ '^[A-Za-z0-9]{6}$' THEN
    RETURN false;
  END IF;

  BEGIN
    v_headers := NULLIF(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_headers := NULL;
  END;

  v_ip := COALESCE(
    NULLIF(v_headers->>'cf-connecting-ip', ''),
    NULLIF(split_part(COALESCE(v_headers->>'x-forwarded-for', ''), ',', 1), ''),
    NULLIF(v_headers->>'x-real-ip', '')
  );
  v_bucket := 'agent-code:ip:' || md5(COALESCE(NULLIF(btrim(v_ip), ''), 'unknown'));

  INSERT INTO public.api_rate_limits(bucket_key, window_started, request_count, updated_at)
  VALUES (v_bucket, v_now, 1, v_now)
  ON CONFLICT (bucket_key) DO UPDATE SET
    request_count = CASE
      WHEN public.api_rate_limits.window_started <= v_now - interval '15 minutes' THEN 1
      ELSE public.api_rate_limits.request_count + 1
    END,
    window_started = CASE
      WHEN public.api_rate_limits.window_started <= v_now - interval '15 minutes' THEN v_now
      ELSE public.api_rate_limits.window_started
    END,
    updated_at = v_now
  RETURNING request_count INTO v_count;

  IF v_count > 30 THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE user_type = 'agente'
      AND agent_code = upper(p_code)
  );
END;
$$;
