-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20260919000000; original ledger name: api_rate_limits.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket_key text PRIMARY KEY,
  window_started timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(
  p_bucket_key text,
  p_window_seconds integer,
  p_max_requests integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_bucket public.api_rate_limits;
BEGIN
  IF length(p_bucket_key) = 0 OR length(p_bucket_key) > 512
     OR p_window_seconds < 1 OR p_window_seconds > 86400
     OR p_max_requests < 1 OR p_max_requests > 1000 THEN
    RETURN false;
  END IF;

  INSERT INTO public.api_rate_limits (bucket_key)
  VALUES (p_bucket_key)
  ON CONFLICT (bucket_key) DO NOTHING;

  SELECT * INTO current_bucket
  FROM public.api_rate_limits
  WHERE bucket_key = p_bucket_key
  FOR UPDATE;

  IF current_bucket.window_started <= now() - make_interval(secs => p_window_seconds) THEN
    UPDATE public.api_rate_limits
    SET window_started = now(), request_count = 1, updated_at = now()
    WHERE bucket_key = p_bucket_key;
    RETURN true;
  END IF;

  IF current_bucket.request_count >= p_max_requests THEN
    RETURN false;
  END IF;

  UPDATE public.api_rate_limits
  SET request_count = request_count + 1, updated_at = now()
  WHERE bucket_key = p_bucket_key;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_api_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(text, integer, integer) TO service_role;

CREATE INDEX IF NOT EXISTS api_rate_limits_updated_at_idx
  ON public.api_rate_limits (updated_at);
