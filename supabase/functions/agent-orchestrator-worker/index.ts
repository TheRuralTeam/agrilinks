import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import { validateSourcingPayload } from "../_shared/agent-task-validation.ts";

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


function currentLuandaDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

async function findSourcingMatches(payload: Record<string, unknown>, db: ReturnType<typeof createClient>): Promise<Record<string, unknown>> {
  const requestId = typeof payload.sourcing_request_id === "string" ? payload.sourcing_request_id : "";
  if (!requestId) {
    return { outcome: "needs_information", missing_fields: ["sourcing_request_id"], verified_supplier_candidates: [], confirmed_quotes: [], side_effects: [] };
  }

  const { data: request, error: requestError } = await db
    .from("sourcing_requests")
    .select("id, product_name, quantity, unit, delivery_date, delivery_province_id, delivery_municipality_id, delivery_location")
    .eq("id", requestId)
    .maybeSingle();
  if (requestError) throw requestError;
  if (!request) {
    return { outcome: "request_not_found", sourcing_request_id: requestId, verified_supplier_candidates: [], confirmed_quotes: [], side_effects: [] };
  }

  const { data: supplierRows, error: suppliersError } = await db
    .from("sourcing_supplier_leads")
    .select("id, company_name, product_name, province_id, municipality_id, locality, verification_status")
    .eq("verification_status", "confirmed")
    .ilike("product_name", request.product_name)
    .limit(100);
  if (suppliersError) throw suppliersError;

  const normalize = (value: unknown) => typeof value === "string" ? value.trim().toLocaleLowerCase("pt-AO") : "";
  const suppliers = (supplierRows ?? []).filter((supplier) =>
    supplier.verification_status === "confirmed" && normalize(supplier.product_name) === normalize(request.product_name)
  );
  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));

  const { data: quoteRows, error: quotesError } = await db
    .from("sourcing_supplier_quotes")
    .select("id, sourcing_request_id, supplier_id, available_quantity, unit, unit_price, currency, availability_status, confirmation_status, expected_delivery_date, valid_until, quality_notes, confirmed_at")
    .eq("sourcing_request_id", request.id)
    .eq("confirmation_status", "confirmed")
    .in("availability_status", ["available", "partially_available"])
    .or(`valid_until.is.null,valid_until.gte.${currentLuandaDate()}`)
    .limit(100);
  if (quotesError) throw quotesError;

  const quotes = (quoteRows ?? [])
    .filter((quote) => supplierById.has(quote.supplier_id) && quote.unit === request.unit)
    .map((quote) => ({
      id: quote.id,
      supplier_id: quote.supplier_id,
      company_name: supplierById.get(quote.supplier_id)?.company_name ?? "Fornecedor confirmado",
      available_quantity: quote.available_quantity,
      unit: quote.unit,
      unit_price: quote.unit_price,
      currency: quote.currency,
      availability_status: quote.availability_status,
      expected_delivery_date: quote.expected_delivery_date,
      valid_until: quote.valid_until,
      quality_notes: quote.quality_notes,
      confirmed_at: quote.confirmed_at,
      covers_requested_quantity: Number(quote.available_quantity) >= Number(request.quantity),
    }));

  const pricedQuotes = quotes.filter((quote) => typeof quote.unit_price === "number").sort((a, b) => Number(a.unit_price) - Number(b.unit_price));
  const outcome = quotes.length
    ? "confirmed_quotes_found"
    : suppliers.length
      ? "verified_suppliers_found_needs_quote"
      : "no_verified_supplier_match";

  return {
    outcome,
    sourcing_request_id: request.id,
    product_name: request.product_name,
    requested_quantity: request.quantity,
    unit: request.unit,
    delivery_date: request.delivery_date,
    delivery_location: request.delivery_location,
    verified_supplier_candidates: suppliers.map((supplier) => ({
      id: supplier.id,
      company_name: supplier.company_name,
      province_id: supplier.province_id,
      municipality_id: supplier.municipality_id,
      locality: supplier.locality,
    })),
    confirmed_quotes: quotes,
    lowest_confirmed_price: pricedQuotes.length ? pricedQuotes[0] : null,
    summary: quotes.length
      ? `Foram encontradas ${quotes.length} cotações confirmadas e ainda válidas de fornecedores verificados. É necessária revisão humana antes de apresentar uma proposta ao comprador.`
      : suppliers.length
        ? `Foram encontrados ${suppliers.length} fornecedores confirmados para o produto, mas não existe cotação confirmada e válida para este pedido.`
        : "Não existe fornecedor confirmado compatível na base de dados. É necessária pesquisa e verificação humana; não foram inventados fornecedores nem preços.",
    side_effects: [],
  };
}

async function buildConsultativeResult(task: AgentTask, db: ReturnType<typeof createClient>): Promise<Record<string, unknown>> {
  const payload = isRecord(task.input_payload) ? task.input_payload : {};

  // The worker reads only existing records and never contacts suppliers or changes commercial data.
  switch (task.task_type) {
    case "sourcing_intake": {
      const missing = validateSourcingPayload(payload);
      if (missing.length) {
        return { mode: "consultative", outcome: "needs_information", missing_fields: missing, side_effects: [] };
      }
      const matches = await findSourcingMatches(payload, db);
      return {
        mode: "consultative",
        ...matches,
        intake_validation: "ready_for_human_review",
        side_effects: [],
      };
    }
    case "supplier_discovery":
      return { mode: "consultative", ...(await findSourcingMatches(payload, db)), side_effects: [] };
    case "quote_comparison": {
      const matches = await findSourcingMatches(payload, db);
      const quotes = Array.isArray(matches.confirmed_quotes) ? matches.confirmed_quotes as Array<Record<string, unknown>> : [];
      const pricedQuotes = quotes.filter((quote) => typeof quote.unit_price === "number")
        .sort((a, b) => Number(a.unit_price) - Number(b.unit_price));
      return {
        mode: "consultative",
        ...matches,
        outcome: pricedQuotes.length ? "quotes_compared" : matches.outcome,
        price_comparison: pricedQuotes,
        comparison_note: pricedQuotes.length
          ? "Comparação ordenada apenas por preços confirmados, na mesma unidade e com validade vigente. Considere também qualidade, entrega e quantidade."
          : "Não há preços confirmados e válidos suficientes para uma comparação de preços.",
        side_effects: [],
      };
    }
    case "missing_information_check": {
      const missing = validateSourcingPayload(payload);
      return { mode: "consultative", outcome: missing.length ? "needs_information" : "no_required_fields_missing", missing_fields: missing, side_effects: [] };
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
  // A unique ID per invocation prevents an expired lease from being completed
  // by an older concurrent invocation that reused the same worker identity.
  const workerId = `consultative-worker-${crypto.randomUUID()}`;

  let processed = 0;
  const outcomes: Array<{ task_id: string; outcome: string }> = [];

  try {
    for (let i = 0; i < MAX_TASKS_PER_INVOCATION; i += 1) {
      const { data: claimed, error: claimError } = await db.rpc("claim_agent_task", {
        p_worker_id: workerId,
        p_lease_seconds: 90,
      });
      if (claimError) throw claimError;

      const task = (Array.isArray(claimed) ? claimed[0] : null) as AgentTask | null;
      if (!task) break;

      if (!TASK_TYPES.has(task.task_type)) {
        const { error: finishError } = await db.rpc("finish_agent_task", {
          p_task_id: task.id,
          p_worker_id: workerId,
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
        const result = await buildConsultativeResult(task, db);
        const outcome = String(result.outcome ?? "completed");
        const { error: finishError } = await db.rpc("finish_agent_task", {
          p_task_id: task.id,
          p_worker_id: workerId,
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
          p_worker_id: workerId,
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
      worker: workerId,
      mode: "consultative",
      processed,
      outcomes,
    });
  } catch (error) {
    console.error("Agent worker invocation failed", String(error).slice(0, 160));
    return jsonResponse({ error: "Falha interna ao processar a fila." }, 500);
  }
});
