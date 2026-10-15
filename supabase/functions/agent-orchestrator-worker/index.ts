import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";

type TaskType =
  | "sourcing_intake"
  | "supplier_discovery"
  | "quote_comparison"
  | "missing_information_check"
  | "notification_draft"
  | "admin_review";

type AgentTask = {
  id: string;
  task_type: TaskType;
  status: string;
  autonomy_mode: "observe" | "suggest" | "execute_low_risk";
  risk_level: "low" | "medium" | "high";
  input_payload: Record<string, unknown>;
  attempt_count: number;
  assigned_agent: string | null;
};

const MAX_TASKS_PER_INVOCATION = 5;
const MAX_ATTEMPTS = 5;
const WORKER_ID = "consultative-worker-v1";
const TASK_TYPES = new Set<TaskType>([
  "sourcing_intake",
  "supplier_discovery",
  "quote_comparison",
  "missing_information_check",
  "notification_draft",
  "admin_review",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function validatePayload(payload: Record<string, unknown>) {
  const missing: string[] = [];
  if (!nonEmptyString(payload.product_name)) missing.push("product_name");
  if (!(typeof payload.quantity === "number" && Number.isFinite(payload.quantity) && payload.quantity > 0)) {
    missing.push("quantity");
  }
  if (!nonEmptyString(payload.unit)) missing.push("unit");
  if (!nonEmptyString(payload.delivery_location)) missing.push("delivery_location");
  return missing;
}

function buildConsultativeResult(task: AgentTask): Record<string, unknown> {
  const payload = isRecord(task.input_payload) ? task.input_payload : {};

  // The worker intentionally produces internal findings only. It does not call
  // payment, messaging, inventory, product, pre-order, or freight mutations.
  switch (task.task_type) {
    case "sourcing_intake": {
      const missing = validatePayload(payload);
      return {
        mode: "consultative",
        outcome: missing.length ? "needs_information" : "ready_for_human_review",
        missing_fields: missing,
        summary: missing.length
          ? "O pedido de sourcing precisa de informação adicional antes da revisão humana."
          : "O pedido está estruturado para revisão humana; ainda não foi enviado a fornecedores.",
        side_effects: [],
      };
    }
    case "missing_information_check": {
      const missing = validatePayload(payload);
      return {
        mode: "consultative",
        outcome: missing.length ? "needs_information" : "no_required_fields_missing",
        missing_fields: missing,
        side_effects: [],
      };
    }
    case "notification_draft": {
      const subject = typeof payload.subject === "string" ? payload.subject.trim().slice(0, 160) : "";
      const message = typeof payload.message === "string" ? payload.message.trim().slice(0, 4000) : "";
      return {
        mode: "consultative",
        outcome: subject && message ? "draft_prepared" : "needs_information",
        draft: subject && message ? { subject, message } : null,
        missing_fields: [!subject ? "subject" : null, !message ? "message" : null].filter(Boolean),
        sent: false,
        side_effects: [],
      };
    }
    case "admin_review":
      return {
        mode: "consultative",
        outcome: "human_review_required",
        note: "O agente não toma decisões administrativas nem altera permissões, contas ou dados comerciais.",
        side_effects: [],
      };
    case "supplier_discovery":
    case "quote_comparison":
      return {
        mode: "consultative",
        outcome: "integration_required",
        note: "Esta tarefa ainda não consulta fornecedores nem preços reais. Não foram inventados resultados.",
        side_effects: [],
      };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  const configuredSecret = Deno.env.get("AGENT_WORKER_SECRET");
  const suppliedSecret = req.headers.get("x-agent-worker-secret");
  if (!configuredSecret || !suppliedSecret || suppliedSecret !== configuredSecret) {
    return jsonResponse({ error: "Não autorizado." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Configuração interna incompleta." }, 503);
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let processed = 0;
  const outcomes: Array<{ task_id: string; outcome: string }> = [];

  try {
    for (let i = 0; i < MAX_TASKS_PER_INVOCATION; i += 1) {
      const { data: claimed, error: claimError } = await db.rpc("claim_agent_task", {
        p_worker_id: WORKER_ID,
        p_lease_seconds: 90,
      });
      if (claimError) throw claimError;

      const task = (Array.isArray(claimed) ? claimed[0] : null) as AgentTask | null;
      if (!task) break;

      if (!TASK_TYPES.has(task.task_type)) {
        const { error: finishError } = await db.rpc("finish_agent_task", {
          p_task_id: task.id,
          p_worker_id: WORKER_ID,
          p_status: "failed",
          p_result_payload: null,
          p_error_code: "TASK_TYPE_NOT_ALLOWED",
          p_retry_seconds: null,
          p_event_type: "task_rejected",
          p_event_payload: { reason: "TASK_TYPE_NOT_ALLOWED" },
        });
        if (finishError) throw finishError;
        outcomes.push({ task_id: task.id, outcome: "rejected" });
        processed += 1;
        continue;
      }

      try {
        const result = buildConsultativeResult(task);
        const outcome = String(result.outcome ?? "completed");
        const { error: finishError } = await db.rpc("finish_agent_task", {
          p_task_id: task.id,
          p_worker_id: WORKER_ID,
          p_status: "completed",
          p_result_payload: result,
          p_error_code: null,
          p_retry_seconds: null,
          p_event_type: "task_completed_consultative",
          p_event_payload: { outcome, attempt_count: task.attempt_count },
        });
        if (finishError) throw finishError;
        outcomes.push({ task_id: task.id, outcome });
      } catch (taskError) {
        const errorCode = "TASK_PROCESSING_ERROR";
        const terminal = task.attempt_count >= MAX_ATTEMPTS;
        const { error: finishError } = await db.rpc("finish_agent_task", {
          p_task_id: task.id,
          p_worker_id: WORKER_ID,
          p_status: terminal ? "failed" : "queued",
          p_result_payload: null,
          p_error_code: errorCode,
          p_retry_seconds: terminal ? null : Math.min(300, 2 ** task.attempt_count * 5),
          p_event_type: terminal ? "task_failed" : "task_retry_scheduled",
          p_event_payload: { error_code: errorCode, attempt_count: task.attempt_count },
        });
        if (finishError) throw finishError;
        outcomes.push({ task_id: task.id, outcome: terminal ? "failed" : "retry_scheduled" });
        // Avoid logging payloads or error messages that may contain personal data.
        console.error("Agent task processing failed", { taskId: task.id, error: String(taskError).slice(0, 160) });
      }
      processed += 1;
    }

    return jsonResponse({
      ok: true,
      worker: WORKER_ID,
      mode: "consultative",
      processed,
      outcomes,
    });
  } catch (error) {
    console.error("Agent worker invocation failed", String(error).slice(0, 160));
    return jsonResponse({ error: "Falha interna ao processar a fila." }, 500);
  }
});
