BEGIN;

-- Atomic task claiming for the trusted worker. This function does not execute
-- business actions; it only leases a queued task and records an event.
CREATE OR REPLACE FUNCTION public.claim_agent_task(
  p_worker_id text,
  p_lease_seconds integer DEFAULT 90
)
RETURNS SETOF public.agent_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_task public.agent_tasks;
BEGIN
  IF p_worker_id IS NULL OR length(btrim(p_worker_id)) < 3 OR length(p_worker_id) > 120 THEN
    RAISE EXCEPTION 'invalid_worker_id' USING ERRCODE = '22023';
  END IF;

  IF p_lease_seconds IS NULL OR p_lease_seconds < 30 OR p_lease_seconds > 600 THEN
    RAISE EXCEPTION 'invalid_lease_seconds' USING ERRCODE = '22023';
  END IF;

  UPDATE public.agent_tasks AS t
  SET status = 'running',
      assigned_agent = p_worker_id,
      locked_at = now(),
      attempt_count = t.attempt_count + 1,
      updated_at = now()
  WHERE t.id = (
    SELECT candidate.id
    FROM public.agent_tasks AS candidate
    WHERE (
      (candidate.status = 'queued' AND candidate.available_at <= now())
      OR
      (candidate.status = 'running'
       AND COALESCE(candidate.locked_at, candidate.updated_at)
           < now() - make_interval(secs => p_lease_seconds))
    )
      AND candidate.attempt_count < 5
    ORDER BY candidate.priority DESC, candidate.available_at ASC, candidate.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING t.* INTO v_task;

  IF v_task.id IS NOT NULL THEN
    INSERT INTO public.agent_events (task_id, event_type, actor_type, payload)
    VALUES (
      v_task.id,
      'task_claimed',
      'system',
      jsonb_build_object(
        'worker_id', p_worker_id,
        'attempt_count', v_task.attempt_count,
        'lease_seconds', p_lease_seconds
      )
    );
    RETURN NEXT v_task;
  END IF;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_agent_task(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_agent_task(text, integer) TO service_role;

COMMIT;
