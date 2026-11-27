-- Queue a consultative agent task for every new pending sourcing request.
-- The frontend uses the same idempotency key, so its submit call reuses this task
-- and dispatches the worker instead of creating a duplicate.

CREATE OR REPLACE FUNCTION public.enqueue_sourcing_agent_intake()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_task_id uuid;
  v_delivery_location text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  v_delivery_location := COALESCE(
    NULLIF(btrim(NEW.delivery_location), ''),
    NULLIF(concat_ws(', ', NULLIF(btrim(NEW.delivery_municipality_id), ''), NULLIF(btrim(NEW.delivery_province_id), '')), '')
  );

  INSERT INTO public.agent_tasks (
    task_type, status, risk_level, autonomy_mode, priority,
    requested_by, subject_type, subject_id, idempotency_key, input_payload
  )
  VALUES (
    'sourcing_intake', 'queued', 'low', 'suggest', 100,
    NEW.user_id, 'sourcing_request', NEW.id, 'sourcing-' || NEW.id::text,
    jsonb_build_object(
      'sourcing_request_id', NEW.id,
      'product_name', NEW.product_name,
      'quantity', NEW.quantity,
      'unit', COALESCE(NULLIF(btrim(NEW.unit), ''), 'kg'),
      'delivery_location', v_delivery_location,
      'delivery_date', NEW.delivery_date,
      'quality_specification', NEW.quality_specification
    )
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_task_id;

  IF v_task_id IS NOT NULL THEN
    INSERT INTO public.agent_events (task_id, event_type, actor_type, actor_id, payload)
    VALUES (
      v_task_id, 'task_submitted', 'system', NEW.user_id,
      jsonb_build_object('task_type', 'sourcing_intake', 'source', 'sourcing_requests_insert_trigger', 'autonomy_mode', 'suggest')
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enqueue_sourcing_agent_intake ON public.sourcing_requests;
CREATE TRIGGER trg_enqueue_sourcing_agent_intake
AFTER INSERT ON public.sourcing_requests
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_sourcing_agent_intake();

-- Recover pending requests created before automatic task enqueueing was installed.
WITH inserted AS (
  INSERT INTO public.agent_tasks (
    task_type, status, risk_level, autonomy_mode, priority,
    requested_by, subject_type, subject_id, idempotency_key, input_payload
  )
  SELECT
    'sourcing_intake', 'queued', 'low', 'suggest', 100,
    r.user_id, 'sourcing_request', r.id, 'sourcing-' || r.id::text,
    jsonb_build_object(
      'sourcing_request_id', r.id,
      'product_name', r.product_name,
      'quantity', r.quantity,
      'unit', COALESCE(NULLIF(btrim(r.unit), ''), 'kg'),
      'delivery_location', COALESCE(
        NULLIF(btrim(r.delivery_location), ''),
        NULLIF(concat_ws(', ', NULLIF(btrim(r.delivery_municipality_id), ''), NULLIF(btrim(r.delivery_province_id), '')), '')
      ),
      'delivery_date', r.delivery_date,
      'quality_specification', r.quality_specification
    )
  FROM public.sourcing_requests r
  WHERE r.status = 'pending'
    AND NOT EXISTS (
      SELECT 1
      FROM public.agent_tasks t
      WHERE t.task_type IN ('sourcing_intake', 'supplier_discovery', 'quote_comparison')
        AND t.input_payload->>'sourcing_request_id' = r.id::text
    )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id, requested_by
)
INSERT INTO public.agent_events (task_id, event_type, actor_type, actor_id, payload)
SELECT
  i.id, 'task_submitted', 'system', i.requested_by,
  jsonb_build_object('task_type', 'sourcing_intake', 'source', 'pending_sourcing_backfill', 'autonomy_mode', 'suggest')
FROM inserted i;
