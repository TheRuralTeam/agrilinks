import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-worker-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validateSourcingPayload(payload: Record<string, unknown>): string[] {
  const missing: string[] = [];
  if (typeof payload.product_name !== "string" || payload.product_name.trim().length === 0) missing.push("product_name");
  if (!(typeof payload.quantity === "number" && Number.isFinite(payload.quantity) && payload.quantity > 0)) missing.push("quantity");
  if (typeof payload.unit !== "string" || payload.unit.trim().length === 0) missing.push("unit");
  if (typeof payload.delivery_location !== "string" || payload.delivery_location.trim().length === 0) missing.push("delivery_location");
  return missing;
}

type TaskType =
  | "sourcing_intake"
  | "supplier_discovery"
  | "quote_comparison"
  | "missing_information_check"
  | "notification_draft"
  | "admin_review";

type SourcingRequestRow = {
  id: string;
  user_id: string;
  product_name: string;
  quantity: number | string;
  unit: string;
  delivery_date: string;
  delivery_province_id: string | null;
  delivery_municipality_id: string | null;
  delivery_location: string | null;
  status: string;
};
type SupplierRow = {
  id: string;
  company_name: string;
  product_name: string;
  province_id: string | null;
  municipality_id: string | null;
  locality: string | null;
  verification_status: string;
};
type SupplierQuoteRow = {
  id: string;
  sourcing_request_id: string;
  supplier_id: string;
  available_quantity: number | string;
  unit: string;
  unit_price: number | string | null;
  currency: string;
  availability_status: string;
  confirmation_status: string;
  expected_delivery_date: string | null;
  valid_until: string | null;
  quality_notes: string | null;
  confirmed_at: string | null;
};

type AgentTask = {
  id: string;
  task_type: TaskType;
  status: string;
  autonomy_mode: "observe" | "suggest" | "execute_low_risk";
  risk_level: "low" | "medium" | "high";
  input_payload: Record<string, unknown>;
  attempt_count: number;
  assigned_agent: string | null;
  requested_by: string | null;
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

function normalizeProductName(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLocaleLowerCase("pt-AO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ")
    : "";
}

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

async function notifySourcingMatchCandidates(db: any, request: SourcingRequestRow, candidates: Array<Record<string, unknown>>): Promise<Record<string, unknown>> {
  const positiveCandidates = candidates.filter((candidate) => candidate.unit_compatible === true && candidate.meets_minimum_order !== false && Number(candidate.available_quantity_estimate) > 0);
  if (!positiveCandidates.length) return { buyer_notified: false, suppliers_notified: 0, emails_queued: 0 };

  const supplierIds = [...new Set(positiveCandidates
    .map((candidate) => typeof candidate.supplier_user_id === "string" ? candidate.supplier_user_id : "")
    .filter((id) => id && id !== request.user_id))];
  const recipientIds = [...new Set([request.user_id, ...supplierIds])];
  const { data: users, error: usersError } = await db
    .from("users")
    .select("id, full_name, email, email_verified")
    .in("id", recipientIds);
  if (usersError) throw usersError;
  const userById = new Map((users ?? []).map((user: any) => [user.id, user]));
  let buyerNotified = false;
  let suppliersNotified = 0;
  let emailsQueued = 0;

  const buyerKey = `sourcing_match:${request.id}:buyer`;
  const buyerUser = userById.get(request.user_id) as any;
  const highestEstimate = Math.max(...positiveCandidates.map((candidate) => Number(candidate.available_quantity_estimate)));
  const fullMatches = positiveCandidates.filter((candidate) => candidate.covers_requested_quantity === true).length;
  const partialMatches = positiveCandidates.filter((candidate) => candidate.partial_quantity === true).length;
  const buyerTitle = "Correspondência encontrada para o seu pedido";
  const buyerMessage = `Encontrámos ${positiveCandidates.length} publicação(ões) activa(s) de ${request.product_name}. O maior stock estimado registado é ${highestEstimate} ${request.unit}, para um pedido de ${request.quantity} ${request.unit}. ${fullMatches ? fullMatches + " publicação(ões) indicam quantidade suficiente" : "Nenhuma publicação indica, neste momento, quantidade suficiente"}. ${partialMatches ? partialMatches + " têm quantidade parcial." : ""} Estes valores vêm das publicações e reservas registadas, não constituem confirmação de stock físico. Aguarde a confirmação do fornecedor antes de comprar.`;
  const { data: existingBuyerNotification, error: buyerLookupError } = await db
    .from("notifications")
    .select("id")
    .eq("user_id", request.user_id)
    .contains("metadata", { dedupe_key: buyerKey })
    .limit(1)
    .maybeSingle();
  if (buyerLookupError) throw buyerLookupError;
  if (!existingBuyerNotification) {
    const { error: insertBuyerError } = await db.from("notifications").insert({
      user_id: request.user_id,
      type: "sourcing_match",
      title: buyerTitle,
      message: buyerMessage,
      metadata: { dedupe_key: buyerKey, sourcing_request_id: request.id, product_name: request.product_name, requested_quantity: request.quantity, unit: request.unit, candidate_count: positiveCandidates.length, highest_estimated_quantity: highestEstimate, verification_status: "listing_estimate_unconfirmed" },
    });
    if (insertBuyerError) throw insertBuyerError;
    buyerNotified = true;
  }
  if (buyerUser?.email && buyerUser.email_verified === true) {
    const { error: buyerEmailError } = await db.from("email_outbox").upsert({
      dedupe_key: buyerKey + ":email",
      recipient: buyerUser.email,
      subject: buyerTitle,
      template: "notification",
      payload: { full_name: buyerUser.full_name ?? "Utilizador AgriLink", title: buyerTitle, message: buyerMessage },
      status: "pending",
      priority: 3,
    }, { onConflict: "dedupe_key", ignoreDuplicates: true });
    if (buyerEmailError) throw buyerEmailError;
    emailsQueued += 1;
  }

  for (const supplierId of supplierIds) {
    const supplierUser = userById.get(supplierId) as any;
    if (!supplierUser) continue;
    const supplierCandidates = positiveCandidates.filter((candidate) => candidate.supplier_user_id === supplierId);
    const supplierEstimate = Math.max(...supplierCandidates.map((candidate) => Number(candidate.available_quantity_estimate)));
    const supplierKey = `sourcing_match:${request.id}:supplier:${supplierId}`;
    const supplierTitle = "Pedido de sourcing compatível com a sua publicação";
    const supplierMessage = `Há um pedido de ${request.quantity} ${request.unit} de ${request.product_name}. A sua publicação indica cerca de ${supplierEstimate} ${request.unit} disponíveis após reservas registadas. Confirme o stock físico actual e indique a quantidade que consegue fornecer. Esta notificação não aceita o pedido nem cria uma venda; a disponibilidade e o preço precisam de confirmação.`;
    const { data: existingSupplierNotification, error: supplierLookupError } = await db
      .from("notifications")
      .select("id")
      .eq("user_id", supplierId)
      .contains("metadata", { dedupe_key: supplierKey })
      .limit(1)
      .maybeSingle();
    if (supplierLookupError) throw supplierLookupError;
    if (!existingSupplierNotification) {
      const { error: insertSupplierError } = await db.from("notifications").insert({
        user_id: supplierId,
        type: "sourcing_match",
        title: supplierTitle,
        message: supplierMessage,
        metadata: { dedupe_key: supplierKey, sourcing_request_id: request.id, product_name: request.product_name, requested_quantity: request.quantity, estimated_available_quantity: supplierEstimate, unit: request.unit, verification_status: "supplier_confirmation_required" },
      });
      if (insertSupplierError) throw insertSupplierError;
      suppliersNotified += 1;
    }
    if (supplierUser.email && supplierUser.email_verified === true) {
      const { error: supplierEmailError } = await db.from("email_outbox").upsert({
        dedupe_key: supplierKey + ":email",
        recipient: supplierUser.email,
        subject: supplierTitle,
        template: "notification",
        payload: { full_name: supplierUser.full_name ?? "Fornecedor AgriLink", title: supplierTitle, message: supplierMessage },
        status: "pending",
        priority: 3,
      }, { onConflict: "dedupe_key", ignoreDuplicates: true });
      if (supplierEmailError) throw supplierEmailError;
      emailsQueued += 1;
    }
  }

  return { buyer_notified: buyerNotified, suppliers_notified: suppliersNotified, emails_queued: emailsQueued, verification_status: "listing_estimates_only" };
}

async function findSourcingMatches(payload: Record<string, unknown>, db: any, requestedBy: string | null, taskType?: TaskType): Promise<Record<string, unknown>> {
  const requestId = typeof payload.sourcing_request_id === "string" ? payload.sourcing_request_id : "";
  if (!requestId) {
    return { outcome: "needs_information", missing_fields: ["sourcing_request_id"], verified_supplier_candidates: [], confirmed_quotes: [], side_effects: [] };
  }

  const { data: requestData, error: requestError } = await db
    .from("sourcing_requests")
    .select("id, user_id, product_name, quantity, unit, delivery_date, delivery_province_id, delivery_municipality_id, delivery_location, status")
    .eq("id", requestId)
    .maybeSingle();
  if (requestError) throw requestError;
  const request = requestData as SourcingRequestRow | null;
  if (!request) {
    return { outcome: "request_not_found", sourcing_request_id: requestId, verified_supplier_candidates: [], confirmed_quotes: [], side_effects: [] };
  }
  // A rejected or closed sourcing request must never trigger new supplier analysis.
  if (request.status !== "pending") {
    return {
      outcome: request.status === "rejected" ? "request_rejected" : "request_not_active",
      sourcing_request_id: requestId,
      request_status: request.status,
      verified_supplier_candidates: [],
      confirmed_quotes: [],
      side_effects: [],
      note: "Pedido encerrado; nenhuma pesquisa de fornecedores foi executada.",
    };
  }

  // Personalised history is context only. Never reuse historical prices as current quotes.
  let priorContext: Record<string, unknown> = {
    similar_completed_requests: 0,
    previous_outcomes: [],
    reused_historical_prices: false,
  };
  if (requestedBy) {
    try {
      const { data: history, error: historyError } = await db
        .from("agent_tasks")
        .select("input_payload, result_payload, created_at")
        .eq("requested_by", requestedBy)
        .eq("task_type", "sourcing_intake")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(30);
      if (historyError) throw historyError;
      const productKey = normalizeProductName(request.product_name);
      const similar = (history ?? []).filter((item: any) =>
        normalizeProductName(item.input_payload?.product_name) === productKey
      ).slice(0, 10);
      const outcomeCounts = new Map<string, number>();
      for (const item of similar) {
        const outcome = typeof item.result_payload?.outcome === "string" ? item.result_payload.outcome : "unknown";
        outcomeCounts.set(outcome, (outcomeCounts.get(outcome) ?? 0) + 1);
      }
      priorContext = {
        similar_completed_requests: similar.length,
        previous_outcomes: [...outcomeCounts.entries()].map(([outcome, count]) => ({ outcome, count })),
        last_similar_request_at: similar[0]?.created_at ?? null,
        reused_historical_prices: false,
        note: similar.length
          ? "Histórico do mesmo utilizador e produto usado apenas para contexto; preços e disponibilidade antigos não são tratados como actuais."
          : "Sem histórico anterior comparável para este produto.",
      };
    } catch {
      priorContext = {
        similar_completed_requests: 0,
        previous_outcomes: [],
        reused_historical_prices: false,
        note: "Histórico anterior indisponível; análise baseada apenas nos dados actuais confirmados.",
      };
    }
  }

  // Active marketplace listings can help discovery, but are explicitly unverified leads, not confirmed supplier quotes.
  const listingData: any[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data: listingPage, error: listingsError } = await db
      .from("products")
      .select("id, user_id, product_type, quantity, reserved_quantity, sale_unit, min_order_quantity, package_weight_kg, price, province_id, municipality_id, status")
      .eq("status", "active")
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (listingsError) throw listingsError;
    listingData.push(...(listingPage ?? []));
    if ((listingPage ?? []).length < pageSize) break;
  }
  const sameProductListings = (listingData ?? []).filter((listing: any) =>
    listing.status === "active" &&
    listing.user_id !== request.user_id &&
    normalizeProductName(listing.product_type) === normalizeProductName(request.product_name) &&
    Math.max(0, Number(listing.quantity ?? 0) - Number(listing.reserved_quantity ?? 0)) > 0
  );

  // Keep same-product listings visible even when sale units differ. A unit mismatch
  // is a potential lead, not a confirmed quantity match; never silently discard it.
  const marketplaceCandidates = sameProductListings.map((listing: any) => {
    const sameMunicipality = Boolean(request.delivery_municipality_id && listing.municipality_id === request.delivery_municipality_id);
    const sameProvince = Boolean(request.delivery_province_id && listing.province_id === request.delivery_province_id);
    const availableQuantityEstimate = Math.max(0, Number(listing.quantity ?? 0) - Number(listing.reserved_quantity ?? 0));
    const listedUnit = typeof listing.sale_unit === "string" ? listing.sale_unit.trim() : "";
    const requestedUnit = String(request.unit ?? "").trim();
    const unitCompatible = !listedUnit || normalizeProductName(listedUnit) === normalizeProductName(requestedUnit);
    const packageWeightKg = Number(listing.package_weight_kg);
    const isKgRequestAndBoxListing =
      normalizeProductName(requestedUnit) === "kg" &&
      normalizeProductName(listedUnit) === "caixa";
    const conversionPossible = isKgRequestAndBoxListing && Number.isFinite(packageWeightKg) && packageWeightKg > 0;
    const estimatedQuantityInRequestedUnit = unitCompatible
      ? availableQuantityEstimate
      : conversionPossible ? availableQuantityEstimate * packageWeightKg : null;
    const minimumOrder = Number(listing.min_order_quantity ?? 0);
    const minimumOrderInRequestedUnit = unitCompatible
      ? minimumOrder
      : conversionPossible ? minimumOrder * packageWeightKg : null;
    const coversRequestedQuantity = estimatedQuantityInRequestedUnit !== null &&
      estimatedQuantityInRequestedUnit >= Number(request.quantity);
    const meetsMinimumOrder = minimumOrderInRequestedUnit === null ||
      Number(request.quantity) >= minimumOrderInRequestedUnit;
    return {
      product_id: listing.id,
      supplier_user_id: listing.user_id,
      quantity_listed: listing.quantity,
      reserved_quantity: listing.reserved_quantity ?? 0,
      available_quantity_estimate: availableQuantityEstimate,
      estimated_quantity_in_requested_unit: estimatedQuantityInRequestedUnit,
      unit_listed: listedUnit || null,
      requested_unit: requestedUnit,
      unit_compatible: unitCompatible,
      unit_conversion_possible: conversionPossible,
      package_weight_kg: Number.isFinite(packageWeightKg) && packageWeightKg > 0 ? packageWeightKg : null,
      minimum_order_quantity: listing.min_order_quantity,
      minimum_order_in_requested_unit: minimumOrderInRequestedUnit,
      meets_minimum_order: meetsMinimumOrder,
      match_type: unitCompatible ? "same_product_unit_compatible" : "same_product_unit_needs_clarification",
      clarification_required: !unitCompatible,
      clarification_reason: !unitCompatible
        ? conversionPossible
          ? "Conversão estimada possível pelo peso por caixa registado; confirmar peso líquido, quantidade mínima e stock com o fornecedor."
          : "Mesmo produto, mas unidade diferente. O peso por caixa não está registado ou não permite conversão; não é possível confirmar cobertura em " + requestedUnit + "."
        : null,
      listed_price: listing.price,
      province_id: listing.province_id,
      municipality_id: listing.municipality_id,
      location_match: sameMunicipality ? "same_municipality" : sameProvince ? "same_province" : "other_location",
      covers_requested_quantity: unitCompatible ? availableQuantityEstimate >= Number(request.quantity) : (conversionPossible ? coversRequestedQuantity : null),
      partial_quantity: unitCompatible ? availableQuantityEstimate < Number(request.quantity) : false,
      verification_status: "unverified_marketplace_listing",
      note: "Quantidade estimada com base na publicação menos reservas registadas; não constitui confirmação de stock físico. Unidades diferentes exigem esclarecimento e validação do fornecedor.",
    };
  });

  const supplierRows: SupplierRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data: supplierPage, error: suppliersError } = await db
      .from("sourcing_supplier_leads")
      .select("id, company_name, product_name, province_id, municipality_id, locality, verification_status")
      .eq("verification_status", "confirmed")
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (suppliersError) throw suppliersError;
    supplierRows.push(...((supplierPage ?? []) as SupplierRow[]));
    if ((supplierPage ?? []).length < pageSize) break;
  }

  const normalize = (value: unknown) => typeof value === "string" ? value.trim().toLocaleLowerCase("pt-AO") : "";
  const suppliers = (supplierRows ?? []).filter((supplier) =>
    supplier.verification_status === "confirmed" && normalizeProductName(supplier.product_name) === normalizeProductName(request.product_name)
  ).map((supplier) => {
    const sameMunicipality = Boolean(request.delivery_municipality_id && supplier.municipality_id === request.delivery_municipality_id);
    const sameProvince = Boolean(request.delivery_province_id && supplier.province_id === request.delivery_province_id);
    return {
      ...supplier,
      location_match: sameMunicipality ? "same_municipality" : sameProvince ? "same_province" : "other_location",
      location_rank: sameMunicipality ? 0 : sameProvince ? 1 : 2,
    };
  }).sort((a, b) => a.location_rank - b.location_rank || a.company_name.localeCompare(b.company_name, "pt-AO"));
  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));

  const { data: quoteData, error: quotesError } = await db
    .from("sourcing_supplier_quotes")
    .select("id, sourcing_request_id, supplier_id, available_quantity, unit, unit_price, currency, availability_status, confirmation_status, expected_delivery_date, valid_until, quality_notes, confirmed_at")
    .eq("sourcing_request_id", request.id)
    .eq("confirmation_status", "confirmed")
    .in("availability_status", ["available", "partially_available"])
    .or(`valid_until.is.null,valid_until.gte.${currentLuandaDate()}`)
    .limit(100);
  if (quotesError) throw quotesError;
  const quoteRows = (quoteData ?? []) as SupplierQuoteRow[];

  const quotes = quoteRows
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
      quantity_coverage_ratio: Number(quote.available_quantity) / Number(request.quantity),
      meets_requested_delivery_date: !request.delivery_date || !quote.expected_delivery_date || quote.expected_delivery_date <= request.delivery_date,
    }));

  const pricedQuotes = quotes
    .filter((quote) => quote.unit_price !== null && quote.unit_price !== undefined && Number.isFinite(Number(quote.unit_price)) && Number(quote.unit_price) >= 0)
    .sort((a, b) =>
      Number(b.covers_requested_quantity) - Number(a.covers_requested_quantity) ||
      Number(b.meets_requested_delivery_date) - Number(a.meets_requested_delivery_date) ||
      Number(a.unit_price) - Number(b.unit_price)
    );
  const fullyCoveredPricedQuotes = pricedQuotes.filter((quote) => quote.covers_requested_quantity);
  const partialPricedQuotes = pricedQuotes.filter((quote) => !quote.covers_requested_quantity);
  const quoteCurrencies = [...new Set(pricedQuotes.map((quote) => String(quote.currency ?? "unknown")))];
  const priceComparisonByCurrency = quoteCurrencies.map((currency) => {
    const currencyQuotes = pricedQuotes.filter((quote) => String(quote.currency ?? "unknown") === currency);
    return { currency, quotes: currencyQuotes, lowest_full_coverage: currencyQuotes.find((quote) => quote.covers_requested_quantity) ?? null, lowest_partial: currencyQuotes.find((quote) => !quote.covers_requested_quantity) ?? null };
  });
  const fullStockMatches = marketplaceCandidates.filter((candidate: any) => candidate.unit_compatible === true && candidate.covers_requested_quantity === true && candidate.meets_minimum_order !== false);
  const partialStockMatches = marketplaceCandidates.filter((candidate: any) => candidate.unit_compatible === true && candidate.partial_quantity === true);
  let notificationSummary: Record<string, unknown> = { buyer_notified: false, suppliers_notified: 0, emails_queued: 0 };
  if (taskType === "sourcing_intake" && marketplaceCandidates.some((candidate: any) => candidate.unit_compatible === true)) {
    try {
      notificationSummary = await notifySourcingMatchCandidates(db, request, marketplaceCandidates);
    } catch (notificationError) {
      console.error("Sourcing match notification failed", { requestId: request.id, error: String(notificationError).slice(0, 160) });
      notificationSummary = { buyer_notified: false, suppliers_notified: 0, emails_queued: 0, error: "notification_delivery_failed" };
    }
  }

  const outcome = quotes.length
    ? "confirmed_quotes_found"
    : suppliers.length
      ? "verified_suppliers_found_needs_quote"
      : marketplaceCandidates.some((candidate: any) => candidate.unit_compatible === true)
        ? "marketplace_listings_need_verification"
        : marketplaceCandidates.length
          ? "marketplace_listings_need_clarification"
          : "no_verified_supplier_match";

  return {
    outcome,
    sourcing_request_id: request.id,
    product_name: request.product_name,
    requested_quantity: request.quantity,
    unit: request.unit,
    delivery_date: request.delivery_date,
    delivery_location: request.delivery_location,
    marketplace_candidates: marketplaceCandidates,
    marketplace_listing_count: marketplaceCandidates.length,
    marketplace_unit_clarification_count: marketplaceCandidates.filter((candidate: any) => candidate.clarification_required).length,
    full_stock_matches: fullStockMatches,
    partial_stock_matches: partialStockMatches,
    match_notification_summary: notificationSummary,
    verified_supplier_candidates: suppliers.map((supplier) => ({
      id: supplier.id,
      company_name: supplier.company_name,
      province_id: supplier.province_id,
      municipality_id: supplier.municipality_id,
      locality: supplier.locality,
      location_match: supplier.location_match,
    })),
    confirmed_quotes: quotes,
    recommended_confirmed_quote: quoteCurrencies.length === 1 && pricedQuotes.length ? pricedQuotes[0] : null,
    lowest_confirmed_price: quoteCurrencies.length === 1 && fullyCoveredPricedQuotes.length ? fullyCoveredPricedQuotes.sort((a, b) => Number(a.unit_price) - Number(b.unit_price))[0] : null,
    lowest_partial_quote: quoteCurrencies.length === 1 && !fullyCoveredPricedQuotes.length && partialPricedQuotes.length ? partialPricedQuotes.sort((a, b) => Number(a.unit_price) - Number(b.unit_price))[0] : null,
    price_comparison_by_currency: priceComparisonByCurrency,
    comparison_method: "Agrupa moedas separadamente; dentro de cada moeda prioriza cobertura integral da quantidade, compatibilidade com a data de entrega e depois preço. Nunca compara valores de moedas diferentes nem apresenta cotação parcial como suficiente.",
    prior_context: priorContext,
    summary: quotes.length
      ? `Foram encontradas ${quotes.length} cotações confirmadas e ainda válidas de fornecedores verificados. ${fullyCoveredPricedQuotes.length ? "Existe pelo menos uma cotação com cobertura integral da quantidade." : "Nenhuma cotação com preço confirmado cobre integralmente a quantidade pedida."} É necessária revisão humana antes de apresentar uma proposta ao comprador.`
      : suppliers.length
        ? `Foram encontrados ${suppliers.length} fornecedores confirmados para o produto, mas não existe cotação confirmada e válida para este pedido.`
        : marketplaceCandidates.some((candidate: any) => candidate.unit_compatible === true)
          ? `Foram encontradas ${marketplaceCandidates.filter((candidate: any) => candidate.unit_compatible === true).length} publicação(ões) activa(s) com unidade compatível e ${marketplaceCandidates.filter((candidate: any) => candidate.clarification_required).length} oferta(s) do mesmo produto que exigem esclarecimento da unidade. As publicações são pistas, não stock físico nem preço confirmado.`
          : marketplaceCandidates.length
            ? `Foi encontrada uma publicação activa do mesmo produto, mas a unidade de venda difere do pedido. A oferta foi mantida como correspondência potencial; é necessário confirmar peso por caixa, quantidade mínima e disponibilidade com o fornecedor.`
            : "Não existe fornecedor confirmado nem publicação activa do mesmo produto na base de dados. É necessária pesquisa e verificação humana; não foram inventados fornecedores nem preços.",
    side_effects: [],
  };
}

async function buildConsultativeResult(task: AgentTask, db: any): Promise<Record<string, unknown>> {
  const payload = isRecord(task.input_payload) ? task.input_payload : {};

  // The worker reads only existing records and never contacts suppliers or changes commercial data.
  switch (task.task_type) {
    case "sourcing_intake": {
      const missing = validateSourcingPayload(payload);
      if (missing.length) {
        return { mode: "consultative", outcome: "needs_information", missing_fields: missing, side_effects: [] };
      }
      const matches = await findSourcingMatches(payload, db, task.requested_by, task.task_type);
      return {
        mode: "consultative",
        ...matches,
        intake_validation: "ready_for_human_review",
        side_effects: [],
      };
    }
    case "supplier_discovery":
      return { mode: "consultative", ...(await findSourcingMatches(payload, db, task.requested_by, task.task_type)), side_effects: [] };
    case "quote_comparison": {
      const matches = await findSourcingMatches(payload, db, task.requested_by, task.task_type);
      const quotes = Array.isArray(matches.confirmed_quotes) ? matches.confirmed_quotes as Array<Record<string, unknown>> : [];
      const pricedQuotes = quotes.filter((quote) => quote.unit_price !== null && quote.unit_price !== undefined && Number.isFinite(Number(quote.unit_price)) && Number(quote.unit_price) >= 0);
      const currencies = [...new Set(pricedQuotes.map((quote) => String(quote.currency ?? "unknown")))];
      const priceComparisonByCurrency = currencies.map((currency) => {
        const currencyQuotes = pricedQuotes.filter((quote) => String(quote.currency ?? "unknown") === currency)
          .sort((a, b) => Number(b.covers_requested_quantity) - Number(a.covers_requested_quantity) || Number(b.meets_requested_delivery_date) - Number(a.meets_requested_delivery_date) || Number(a.unit_price) - Number(b.unit_price));
        return { currency, quotes: currencyQuotes };
      });
      return {
        mode: "consultative",
        ...matches,
        outcome: pricedQuotes.length ? (currencies.length > 1 ? "quotes_compared_by_currency" : "quotes_compared") : matches.outcome,
        price_comparison_by_currency: priceComparisonByCurrency,
        comparison_note: pricedQuotes.length
          ? currencies.length > 1
            ? "Cotações separadas por moeda; não foi calculado um vencedor global sem taxa de câmbio verificável. Dentro de cada moeda, a ordenação considera cobertura, entrega e preço."
            : "Comparação de cotações confirmadas da mesma moeda e unidade, com validade vigente; considera cobertura integral da quantidade, data de entrega e preço."
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
  const authorization = req.headers.get("authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Configuração interna incompleta." }, 503);
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const serviceRoleAuthorized = authorization === `Bearer ${serviceRoleKey}`;
  let dedicatedSecretAuthorized = Boolean(
    configuredSecret && suppliedSecret && suppliedSecret === configuredSecret
  );

  // The scheduled database worker reads its shared secret from Vault. Verify it
  // through a service-role-only RPC; never trust the public anon key by itself.
  if (!serviceRoleAuthorized && !dedicatedSecretAuthorized && suppliedSecret) {
    try {
      const { data, error } = await db.rpc("verify_agent_worker_secret", {
        p_secret: suppliedSecret,
      });
      dedicatedSecretAuthorized = !error && data === true;
    } catch {
      dedicatedSecretAuthorized = false;
    }
  }

  if (!serviceRoleAuthorized && !dedicatedSecretAuthorized) {
    return jsonResponse({ error: "Não autorizado." }, 401);
  }
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

    // Inspect the durable queue after every run. This also schedules a continuation
    // when a retry is not available yet, including after an invocation processes zero tasks.
    const { data: nextQueuedTask, error: queueCheckError } = await db
      .from("agent_tasks")
      .select("available_at")
      .eq("status", "queued")
      .order("available_at", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (queueCheckError) {
      console.error("Agent queue continuation check failed", queueCheckError.code);
    } else if (nextQueuedTask) {
      const nextAvailableAt = Date.parse(String(nextQueuedTask.available_at));
      const delayMs = Number.isFinite(nextAvailableAt)
        ? Math.max(250, Math.min(85000, nextAvailableAt - Date.now() + 250))
        : 1000;
      EdgeRuntime.waitUntil((async () => {
        try {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          const continuationUrl = supabaseUrl.replace(/\/+$/, "") + "/functions/v1/agent-orchestrator-worker";
          const continuation = await fetch(continuationUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": serviceRoleKey,
              "Authorization": "Bearer " + serviceRoleKey,
            },
            body: "{}",
          });
          await continuation.text();
          if (!continuation.ok) console.error("Agent worker continuation failed", { status: continuation.status });
        } catch (continuationError) {
          console.error("Agent worker continuation failed", String(continuationError).slice(0, 160));
        }
      })());
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
