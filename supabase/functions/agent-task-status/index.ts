import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  const authorization = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Não autorizado." }, 401);
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = authorization.slice("Bearer ".length).trim();
  const { data: authData, error: authError } = await db.auth.getUser(token);
  if (authError || !authData.user) return jsonResponse({ error: "Sessão inválida." }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }
  if (!isRecord(body) || !Array.isArray(body.request_ids) || body.request_ids.length > 50) {
    return jsonResponse({ error: "request_ids deve ser uma lista com até 50 pedidos." }, 400);
  }
  const requestIds = [...new Set(body.request_ids.filter((id): id is string =>
    typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  ))];
  if (requestIds.length === 0) return jsonResponse({ tasks: [] });

  const keys = requestIds.map((id) => `sourcing-${id}`);
  const { data, error } = await db
    .from("agent_tasks")
    .select("id, idempotency_key, input_payload, task_type, status, result_payload, error_code, created_at, completed_at")
    .eq("requested_by", authData.user.id)
    .in("input_payload->>sourcing_request_id", requestIds)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Agent task status lookup failed", error.code);
    return jsonResponse({ error: "Não foi possível consultar o estado dos agentes." }, 500);
  }

  // If a queued task is found, use the authenticated status poll to recover
  // tasks whose original dispatch failed before reaching the worker.
  if ((data ?? []).some((task) => task.status === "queued")) {
    try {
      const workerUrl = supabaseUrl.replace(/\/+$/, "") + "/functions/v1/agent-orchestrator-worker";
      const workerResponse = await fetch(workerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceRoleKey,
          "Authorization": "Bearer " + serviceRoleKey,
        },
        body: "{}",
      });
      await workerResponse.text();
      if (!workerResponse.ok) {
        console.error("Queued agent task recovery dispatch failed", { status: workerResponse.status });
      }
    } catch (dispatchError) {
      console.error("Queued agent task recovery dispatch failed", String(dispatchError).slice(0, 160));
    }
  }

  const latestByRequest = new Map<string, any>();
  for (const task of data ?? []) {
    const payloadRequestId = isRecord(task.input_payload) && typeof task.input_payload.sourcing_request_id === "string"
      ? task.input_payload.sourcing_request_id
      : (typeof task.idempotency_key === "string" && task.idempotency_key.startsWith("sourcing-")
        ? task.idempotency_key.slice("sourcing-".length)
        : null);
    if (payloadRequestId && !latestByRequest.has(payloadRequestId)) latestByRequest.set(payloadRequestId, task);
  }
  const tasks = [...latestByRequest.values()].map((task) => {
    const result = isRecord(task.result_payload) ? task.result_payload : {};
    const payloadRequestId = isRecord(task.input_payload) && typeof task.input_payload.sourcing_request_id === "string"
      ? task.input_payload.sourcing_request_id
      : null;
    const requestId = payloadRequestId ?? (task.idempotency_key.startsWith("sourcing-")
      ? task.idempotency_key.slice("sourcing-".length)
      : null);
    const candidates = Array.isArray(result.verified_supplier_candidates) ? result.verified_supplier_candidates.length : 0;
    const marketplaceListings = Number(result.marketplace_listing_count ?? (Array.isArray(result.marketplace_candidates) ? result.marketplace_candidates.length : 0));
    const quotes = Array.isArray(result.confirmed_quotes) ? result.confirmed_quotes.length : 0;
    const fullStockMatches = Array.isArray(result.full_stock_matches) ? result.full_stock_matches.length : 0;
    const partialStockMatches = Array.isArray(result.partial_stock_matches) ? result.partial_stock_matches.length : 0;
    const stockMatchDetails = Array.isArray(result.marketplace_candidates)
      ? result.marketplace_candidates.slice(0, 10).filter(isRecord).map((candidate) => ({
          product_id: typeof candidate.product_id === "string" ? candidate.product_id : null,
          available_quantity_estimate: Number(candidate.available_quantity_estimate ?? 0),
          unit: typeof candidate.unit_listed === "string" ? candidate.unit_listed : (typeof result.unit === "string" ? result.unit : null),
          covers_requested_quantity: candidate.covers_requested_quantity === true,
          partial_quantity: candidate.partial_quantity === true,
          unit_compatible: candidate.unit_compatible === true,
          clarification_required: candidate.clarification_required === true,
          clarification_reason: typeof candidate.clarification_reason === "string" ? candidate.clarification_reason : null,
          unit_listed: typeof candidate.unit_listed === "string" ? candidate.unit_listed : null,
          package_weight_kg: Number.isFinite(Number(candidate.package_weight_kg)) && Number(candidate.package_weight_kg) > 0 ? Number(candidate.package_weight_kg) : null,
          meets_minimum_order: candidate.meets_minimum_order === true ? true : candidate.meets_minimum_order === false ? false : null,
          minimum_order_in_requested_unit: candidate.minimum_order_in_requested_unit != null && Number.isFinite(Number(candidate.minimum_order_in_requested_unit)) ? Number(candidate.minimum_order_in_requested_unit) : null,
          commercially_eligible: candidate.commercially_eligible === true ? true : candidate.commercially_eligible === false ? false : null,
          location_match: typeof candidate.location_match === "string" ? candidate.location_match : "unknown",
          listed_price: candidate.listed_price ?? null,
          verification_status: "unverified_marketplace_listing",
        }))
      : [];
    const priorContext = isRecord(result.prior_context) ? {
      similar_completed_requests: Number(result.prior_context.similar_completed_requests ?? 0),
      previous_outcomes: Array.isArray(result.prior_context.previous_outcomes) ? result.prior_context.previous_outcomes : [],
    } : null;
    return {
      request_id: requestId,
      task_id: task.id,
      task_type: task.task_type,
      status: task.status,
      outcome: typeof result.outcome === "string" ? result.outcome : null,
      summary: typeof result.summary === "string" ? result.summary : null,
      verified_supplier_count: candidates,
      marketplace_listing_count: marketplaceListings,
      confirmed_quote_count: quotes,
      full_stock_match_count: fullStockMatches,
      partial_stock_match_count: partialStockMatches,
      stock_match_details: stockMatchDetails,
      prior_context: priorContext,
      error_code: task.error_code,
      created_at: task.created_at,
      completed_at: task.completed_at,
    };
  });
  return jsonResponse({ tasks });
});
