BEGIN;

-- Atomically create a task and its audit event. The caller must be a trusted
-- server-side function that has already validated the end-user JWT.
CREATE OR REPLACE FUNCTION public.submit_agent_task(
  p_task_type text,
  p_risk_level text,
  p_autonomy_mode text,
  p_requested_by uuid,
  p_idempotency_key text,
  p_input_payload jsonb
)
RETURNS SETOF public.agent_tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_task public.agent_tasks;
BEGIN
  IF p_task_type NOT IN (
    'sourcing_intake', 'supplier_discovery', 'quote_comparison',
    'missing_information_check', 'notification_draft'
  ) THEN
    RAISE EXCEPTION 'task_type_not_allowed' USING ERRCODE = '22023';
  END IF;

  IF p_risk_level NOT IN ('low', 'medium') THEN
    RAISE EXCEPTION 'risk_level_not_allowed' USING ERRCODE = '22023';
  END IF;

  IF p_autonomy_mode NOT IN ('observe', 'suggest') THEN
    RAISE EXCEPTION 'autonomy_mode_not_allowed' USING ERRCODE = '22023';
  END IF;

  IF p_requested_by IS NULL
     OR p_idempotency_key IS NULL
     OR length(btrim(p_idempotency_key)) < 8
     OR length(p_idempotency_key) > 128
     OR p_input_payload IS NULL
     OR jsonb_typeof(p_input_payload) <> 'object' THEN
    RAISE EXCEPTION 'invalid_task_input' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.agent_tasks (
    task_type, risk_level, autonomy_mode, requested_by,
    idempotency_key, input_payload, status, priority
  ) VALUES (
    p_task_type, p_risk_level, p_autonomy_mode, p_requested_by,
    p_idempotency_key, p_input_payload, 'queued', 50
  )
  RETURNING * INTO v_task;

  INSERT INTO public.agent_events (
    task_id, event_type, actor_type, actor_id, payload
  ) VALUES (
    v_task.id,
    'task_submitted',
    'human',
    p_requested_by,
    jsonb_build_object('task_type', p_task_type, 'autonomy_mode', p_autonomy_mode)
  );

  RETURN NEXT v_task;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_agent_task(text, text, text, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_agent_task(text, text, text, uuid, text, jsonb)
  TO service_role;

-- Tasks that exhausted retries and whose final worker lease expired must not
-- remain permanently in the running state.
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
  v_expired record;
BEGIN
  IF p_worker_id IS NULL OR length(btrim(p_worker_id)) < 3 OR length(p_worker_id) > 120 THEN
    RAISE EXCEPTION 'invalid_worker_id' USING ERRCODE = '22023';
  END IF;
  IF p_lease_seconds IS NULL OR p_lease_seconds < 30 OR p_lease_seconds > 600 THEN
    RAISE EXCEPTION 'invalid_lease_seconds' USING ERRCODE = '22023';
  END IF;

  FOR v_expired IN
    SELECT t.id
    FROM public.agent_tasks AS t
    WHERE t.status = 'running'
      AND t.attempt_count >= 5
      AND COALESCE(t.locked_at, t.updated_at) < now() - make_interval(secs => p_lease_seconds)
    ORDER BY t.updated_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 25
  LOOP
    UPDATE public.agent_tasks
    SET status = 'failed', error_code = 'MAX_ATTEMPTS_EXCEEDED',
        locked_at = NULL, updated_at = now()
    WHERE id = v_expired.id;

    INSERT INTO public.agent_events (task_id, event_type, actor_type, payload)
    VALUES (v_expired.id, 'task_failed', 'system',
      jsonb_build_object('error_code', 'MAX_ATTEMPTS_EXCEEDED'));
  END LOOP;

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
      v_task.id, 'task_claimed', 'system',
      jsonb_build_object('worker_id', p_worker_id,
        'attempt_count', v_task.attempt_count, 'lease_seconds', p_lease_seconds)
    );
    RETURN NEXT v_task;
  END IF;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_agent_task(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_agent_task(text, integer) TO service_role;

COMMIT;
