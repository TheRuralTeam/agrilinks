import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";

const TASK_TYPES = new Set([
  "sourcing_intake",
  "supplier_discovery",
  "quote_comparison",
  "missing_information_check",
  "notification_draft",
]);
const AUTONOMY_MODES = new Set(["observe", "suggest"]);
const MAX_BODY_BYTES = 32 * 1024;
const MAX_ACTIVE_TASKS_PER_USER = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function dispatchWorker(supabaseUrl: string, serviceRoleKey: string): Promise<void> {
  const workerSecret = Deno.env.get("AGENT_WORKER_SECRET");
  if (!workerSecret) {
    console.error("Agent worker dispatch skipped: required secret is missing");
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/functions/v1/agent-orchestrator-worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
        "x-agent-worker-secret": workerSecret,
      },
      body: "{}",
    });
    await response.text();
    if (!response.ok) {
      console.error("Agent worker dispatch failed", { status: response.status });
    }
  } catch {
    console.error("Agent worker dispatch failed: network or runtime error");
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  const authorization = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Não autorizado." }, 401);
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return jsonResponse({ error: "Não autorizado." }, 401);

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await db.auth.getUser(token);
  if (authError || !authData.user) return jsonResponse({ error: "Sessão inválida." }, 401);

  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return jsonResponse({ error: "Pedido demasiado grande." }, 413);

  let body: unknown;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: "Pedido demasiado grande." }, 413);
    }
    body = JSON.parse(raw);
  } catch {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }
  if (!isRecord(body)) return jsonResponse({ error: "Corpo inválido." }, 400);

  const taskType = typeof body.task_type === "string" ? body.task_type : "";
  if (!TASK_TYPES.has(taskType)) {
    return jsonResponse({ error: "Tipo de tarefa não permitido." }, 400);
  }

  const autonomyMode = typeof body.autonomy_mode === "string" ? body.autonomy_mode : "suggest";
  if (!AUTONOMY_MODES.has(autonomyMode)) {
    return jsonResponse({ error: "A submissão pública só permite os modos observe e suggest." }, 400);
  }

  const idempotencyKey = typeof body.idempotency_key === "string" ? body.idempotency_key.trim() : "";
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    return jsonResponse({ error: "idempotency_key deve ter entre 8 e 128 caracteres." }, 400);
  }
  const payload = body.input_payload === undefined ? {} : body.input_payload;
  if (!isRecord(payload)) return jsonResponse({ error: "input_payload deve ser um objecto JSON." }, 400);

  const { data: existing, error: existingError } = await db
    .from("agent_tasks")
    .select("id, status, task_type")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existingError) {
    console.error("Agent idempotency lookup failed", existingError.code);
    return jsonResponse({ error: "Não foi possível validar a chave de idempotência." }, 500);
  }
  if (existing) {
    const { data: owned } = await db.from("agent_tasks").select("id, status, task_type")
      .eq("id", existing.id).eq("requested_by", authData.user.id).maybeSingle();
    if (!owned) return jsonResponse({ error: "Chave de idempotência já utilizada." }, 409);
    if (owned.status === "queued") EdgeRuntime.waitUntil(dispatchWorker(supabaseUrl, serviceRoleKey));
    return jsonResponse({ task: owned, reused: true }, 200);
  }

  const { count, error: countError } = await db
    .from("agent_tasks")
    .select("id", { count: "exact", head: true })
    .eq("requested_by", authData.user.id)
    .in("status", ["queued", "running", "waiting_approval"]);
  if (countError) {
    console.error("Agent queue limit check failed", countError.code);
    return jsonResponse({ error: "Não foi possível validar a fila." }, 500);
  }
  if ((count ?? 0) >= MAX_ACTIVE_TASKS_PER_USER) {
    return jsonResponse({ error: "Limite de tarefas activas atingido." }, 429);
  }

  const riskLevel = taskType === "notification_draft" ? "medium" : "low";
  const { data: submitted, error: submitError } = await db.rpc("submit_agent_task", {
    p_task_type: taskType,
    p_risk_level: riskLevel,
    p_autonomy_mode: autonomyMode,
    p_requested_by: authData.user.id,
    p_idempotency_key: idempotencyKey,
    p_input_payload: payload,
  });

  if (submitError) {
    if (submitError.code === "23505") {
      // Two concurrent requests can both pass the initial lookup. Re-read the
      // unique key after the conflict so retries by the same owner stay
      // idempotent, without disclosing another user's task.
      const { data: raced } = await db.from("agent_tasks")
        .select("id, status, task_type, requested_by")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (raced?.requested_by === authData.user.id) {
        if (raced.status === "queued") EdgeRuntime.waitUntil(dispatchWorker(supabaseUrl, serviceRoleKey));
        return jsonResponse({
          task: { id: raced.id, status: raced.status, task_type: raced.task_type },
          reused: true,
        }, 200);
      }
      return jsonResponse({ error: "Chave de idempotência já utilizada." }, 409);
    }
    console.error("Agent task submission failed", submitError.code);
    return jsonResponse({ error: "Não foi possível criar a tarefa." }, 500);
  }

  const task = Array.isArray(submitted) ? submitted[0] : null;
  if (!task) return jsonResponse({ error: "Não foi possível confirmar a tarefa criada." }, 500);

  // Start the worker without blocking the authenticated submission response.
  // The task remains durable in Postgres if dispatch fails and can be retried later.
  EdgeRuntime.waitUntil(dispatchWorker(supabaseUrl, serviceRoleKey));

  return jsonResponse({ task: { id: task.id, task_type: task.task_type, status: task.status, autonomy_mode: task.autonomy_mode, created_at: task.created_at }, reused: false, audit_event_recorded: true, worker_dispatch: "scheduled" }, 202);
});
