-- Recovered from supabase_migrations.schema_migrations on 2026-11-18.
-- Ledger version: 20261003020000; original ledger name: nominatim_geocoding_proxy.
-- SQL segments are preserved in ledger order; formatting may differ from the original file.

CREATE TABLE IF NOT EXISTS public.map_geocoding_cache (
  query_key text PRIMARY KEY,
  results jsonb NOT NULL,
  cached_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.map_geocoding_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  last_requested_at timestamptz
);

INSERT INTO public.map_geocoding_state (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.map_geocoding_cache ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.map_geocoding_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.map_geocoding_cache, public.map_geocoding_state
  FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_geocoding_cache TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.map_geocoding_state TO service_role;

CREATE OR REPLACE FUNCTION public.claim_map_geocoding_request(p_query_key text)
RETURNS TABLE(cached_results jsonb, request_allowed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_results jsonb;
  v_claimed boolean;
BEGIN
  DELETE FROM public.map_geocoding_cache
  WHERE query_key = p_query_key
    AND cached_at < now() - interval '30 days';

  SELECT cache.results
  INTO v_results
  FROM public.map_geocoding_cache AS cache
  WHERE cache.query_key = p_query_key
    AND cache.cached_at >= now() - interval '30 days';

  IF FOUND THEN
    RETURN QUERY SELECT v_results, false;
    RETURN;
  END IF;

  UPDATE public.map_geocoding_state
  SET last_requested_at = clock_timestamp()
  WHERE singleton = true
    AND (
      last_requested_at IS NULL
      OR last_requested_at <= clock_timestamp() - interval '1 second'
    );
  v_claimed := FOUND;

  RETURN QUERY SELECT NULL::jsonb, v_claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_map_geocoding_request(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_map_geocoding_request(text) TO service_role;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'cleanup-map-geocoding-cache';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'cleanup-map-geocoding-cache',
    '31 4 * * *',
    $command$
      DELETE FROM public.map_geocoding_cache
      WHERE cached_at < now() - interval '30 days'
    $command$
  );
END;
$$;
