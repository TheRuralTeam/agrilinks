import { z } from "npm:zod@3.23.8";
import { handleCors, jsonResponse } from "../_shared/http.ts";
import { supabase } from "../_shared/supabase.ts";
import { paymentProviderRegistry } from "../_shared/payments/registry.ts";
import { withBoundedBody } from "../_shared/payments/webhookHandler.ts";
import { normalizePaymentAmount } from "../_shared/payments/money.ts";

const Schema = z.object({
  pre_order_id: z.string().uuid(),
  provider_id: z.string().regex(/^[a-z][a-z0-9_-]{1,49}$/),
  idempotency_key: z.string().uuid(),
}).strict();

Deno.serve(async (request: Request) => {
  const cors = handleCors(request);
  if (cors) return cors;
  const token = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return jsonResponse({ error: "Authentication required" }, 401);
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return jsonResponse({ error: "Authentication required" }, 401);

  let input: z.infer<typeof Schema>;
  try {
    const body = await withBoundedBody(request, 16 * 1024);
    const parsed = Schema.safeParse(await body.json());
    if (!parsed.success) return jsonResponse({ error: "Invalid checkout request" }, 400);
    input = parsed.data;
  } catch {
    return jsonResponse({ error: "Invalid or oversized checkout request" }, 400);
  }
  if (!paymentProviderRegistry.has(input.provider_id)) return jsonResponse({ error: "Payment provider is not configured" }, 503);

  const { data: summary, error: summaryError } = await supabase.rpc("get_marketplace_checkout_summary", { p_pre_order_id: input.pre_order_id });
  if (summaryError) return jsonResponse({ error: "Checkout summary unavailable" }, 503);
  const checkout = Array.isArray(summary) ? summary[0] : summary;
  if (!checkout) return jsonResponse({ error: "Order not found" }, 404);
  if (!checkout.payment_ready) return jsonResponse({ error: checkout.reason ?? "Checkout not ready" }, 409);

  const amount = normalizePaymentAmount(String(checkout.total));
  const values = {
    user_id: auth.user.id, wallet_id: null, provider_id: input.provider_id,
    idempotency_key: input.idempotency_key, amount, currency: "AOA",
    pre_order_id: input.pre_order_id, purpose: "order_payment",
    description: "Pagamento AgriLink " + input.pre_order_id,
  };
  const { data: intent, error: intentError } = await supabase.from("payment_intents")
    .upsert(values, { onConflict: "user_id,idempotency_key", ignoreDuplicates: true })
    .select("id,status,provider_reference,amount,pre_order_id,checkout_url").maybeSingle();
  if (intentError || !intent) return jsonResponse({ error: "Payment intent unavailable" }, 503);

  let providerReference = intent.provider_reference;
  let checkoutUrl = intent.checkout_url ?? null;
  if (!providerReference) {
    const created = await paymentProviderRegistry.createCheckout(input.provider_id, {
      intentId: intent.id, idempotencyKey: input.idempotency_key, amount, currency: "AOA",
      description: "Pagamento AgriLink " + input.pre_order_id,
      returnUrl: Deno.env.get("PAYMENT_RETURN_URL") ?? "",
    });
    providerReference = created.providerReference;
    checkoutUrl = created.checkoutUrl ?? null;
    const { error } = await supabase.from("payment_intents").update({
      provider_reference: providerReference, checkout_url: checkoutUrl, status: "pending", updated_at: new Date().toISOString(),
    }).eq("id", intent.id).eq("status", "created").is("provider_reference", null);
    if (error) return jsonResponse({ error: "Payment intent update unavailable" }, 503);
  }
  return jsonResponse({ intent_id: intent.id, pre_order_id: input.pre_order_id, amount, currency: "AOA", status: "pending", checkout_url: checkoutUrl }, 200);
});