BEGIN;

-- Internal orchestration ledger. No client-side access: all reads/writes must
-- go through a trusted server-side worker or Edge Function.
CREATE TABLE IF NOT EXISTS public.agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type text NOT NULL CHECK (task_type IN (
    'sourcing_intake', 'supplier_discovery', 'quote_comparison',
    'missing_information_check', 'notification_draft', 'admin_review'
  )),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'running', 'awaiting_approval', 'succeeded', 'failed', 'cancelled'
  )),
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  autonomy_mode text NOT NULL DEFAULT 'observe' CHECK (autonomy_mode IN ('observe', 'suggest', 'execute_low_risk')),
  priority smallint NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 100),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject_type text,
  subject_id uuid,
  idempotency_key text UNIQUE,
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(input_payload) = 'object'),
  result_payload jsonb CHECK (result_payload IS NULL OR jsonb_typeof(result_payload) = 'object'),
  assigned_agent text,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  completed_at timestamptz,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    status <> 'succeeded' OR completed_at IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_dispatch
  ON public.agent_tasks (priority DESC, available_at ASC, created_at ASC)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_agent_tasks_subject
  ON public.agent_tasks (subject_type, subject_id, created_at DESC)
  WHERE subject_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_tasks_requested_by
  ON public.agent_tasks (requested_by, created_at DESC);

CREATE TABLE IF NOT EXISTS public.agent_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id uuid REFERENCES public.agent_tasks(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (length(btrim(event_type)) BETWEEN 1 AND 120),
  actor_type text NOT NULL CHECK (actor_type IN ('system', 'agent', 'human')),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_events_task_created
  ON public.agent_events (task_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.agent_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.agent_tasks(id) ON DELETE RESTRICT,
  action_type text NOT NULL CHECK (length(btrim(action_type)) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(request_payload) = 'object'),
  decision_payload jsonb CHECK (decision_payload IS NULL OR jsonb_typeof(decision_payload) = 'object'),
  expires_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status IN ('approved', 'rejected') AND decided_at IS NOT NULL AND reviewed_by IS NOT NULL)
    OR status NOT IN ('approved', 'rejected')
  )
);

CREATE INDEX IF NOT EXISTS idx_agent_approvals_pending
  ON public.agent_approvals (created_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_agent_approvals_task
  ON public.agent_approvals (task_id, created_at DESC);

ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_approvals ENABLE ROW LEVEL SECURITY;

-- Deliberately no policies for anon/authenticated: deny client access by default.
REVOKE ALL ON TABLE public.agent_tasks, public.agent_events, public.agent_approvals
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_tasks, public.agent_approvals
  TO service_role;
-- Event history is append-only even for the trusted worker role.
GRANT SELECT, INSERT ON TABLE public.agent_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.agent_events_id_seq TO service_role;

COMMIT;
