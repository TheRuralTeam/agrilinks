import { createClient } from "npm:@supabase/supabase-js@2.57.4";
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

type PaymentIntent = {
  id: string;
  user_id: string;
  idempotency_key: string;
  provider_id: string;
  purpose: string;
  pre_order_id: string | null;
  amount: number | string;
  currency: string;
  status: string;
  provider_reference: string | null;
  checkout_url: string | null;
};

const intentColumns = "id,user_id,idempotency_key,provider_id,purpose,pre_order_id,amount,currency,status,provider_reference,checkout_url";

const matchesIntent = (intent: PaymentIntent, userId: string, preOrderId: string, providerId: string, amount: string) =>
  intent.user_id === userId
  && intent.pre_order_id === preOrderId
  && intent.provider_id === providerId
  && intent.purpose === "order_payment"
  && Number(intent.amount) === Number(amount)
  && intent.currency === "AOA";

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

  if (!paymentProviderRegistry.has(input.provider_id)) {
    return jsonResponse({ error: "Payment provider is not configured" }, 503);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !anonKey) {
    return jsonResponse({ error: "Checkout authentication is not configured" }, 503);
  }

  // A RPC usa auth.uid(); por isso o resumo deve ser consultado com o JWT do comprador,
  // não com o cliente service_role partilhado pelas funções Edge.
  const userSupabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: keyedIntentData, error: keyedIntentError } = await supabase
    .from("payment_intents")
    .select(intentColumns)
    .eq("user_id", auth.user.id)
    .eq("idempotency_key", input.idempotency_key)
    .maybeSingle();

  if (keyedIntentError) return jsonResponse({ error: "Payment intent lookup unavailable" }, 503);

  let intent = keyedIntentData as PaymentIntent | null;
  if (intent && (
    intent.pre_order_id !== input.pre_order_id
    || intent.provider_id !== input.provider_id
    || intent.purpose !== "order_payment"
  )) {
    return jsonResponse({ error: "Idempotency key was already used for a different payment request" }, 409);
  }

  // Repetições de uma tentativa já terminada devolvem o resultado registado,
  // sem criar uma nova cobrança nem chamar novamente o provedor.
  if (intent && ["succeeded", "refunded", "failed", "cancelled", "expired"].includes(intent.status)) {
    return jsonResponse({
      intent_id: intent.id,
      pre_order_id: intent.pre_order_id,
      amount: normalizePaymentAmount(String(intent.amount)),
      currency: intent.currency,
      status: intent.status,
      checkout_url: intent.checkout_url,
    }, 200);
  }

  const { data: summary, error: summaryError } = await userSupabase.rpc(
    "get_marketplace_checkout_summary",
    { p_pre_order_id: input.pre_order_id },
  );
  if (summaryError) return jsonResponse({ error: "Checkout summary unavailable" }, 503);

  const checkout = Array.isArray(summary) ? summary[0] : summary;
  if (!checkout) return jsonResponse({ error: "Order not found" }, 404);
  if (!checkout.payment_ready) return jsonResponse({ error: checkout.reason ?? "Checkout not ready" }, 409);

  const amount = normalizePaymentAmount(String(checkout.total));

  if (intent && !matchesIntent(intent, auth.user.id, input.pre_order_id, input.provider_id, amount)) {
    return jsonResponse({ error: "Existing payment intent does not match the current checkout" }, 409);
  }

  if (!intent) {
    const { data: activeIntentData, error: activeIntentError } = await supabase
      .from("payment_intents")
      .select(intentColumns)
      .eq("user_id", auth.user.id)
      .eq("pre_order_id", input.pre_order_id)
      .in("status", ["created", "pending", "processing"])
      .maybeSingle();

    if (activeIntentError) return jsonResponse({ error: "Active payment lookup unavailable" }, 503);

    const activeIntent = activeIntentData as PaymentIntent | null;
    if (activeIntent) {
      if (!matchesIntent(activeIntent, auth.user.id, input.pre_order_id, input.provider_id, amount)) {
        return jsonResponse({ error: "An active payment attempt already exists for this order" }, 409);
      }
      intent = activeIntent;
    } else {
      const values = {
        user_id: auth.user.id,
        wallet_id: null,
        provider_id: input.provider_id,
        idempotency_key: input.idempotency_key,
        amount,
        currency: "AOA",
        status: "created",
        pre_order_id: input.pre_order_id,
        purpose: "order_payment",
        description: "Pagamento AgriLink " + input.pre_order_id,
      };

      const { data: insertedIntent, error: insertError } = await supabase
        .from("payment_intents")
        .insert(values)
        .select(intentColumns)
        .single();

      if (insertError) {
        // Duas requisições concorrentes podem vencer a mesma restrição única.
        // Recuperar a intenção vencedora torna o retry seguro.
        if (insertError.code !== "23505") {
          return jsonResponse({ error: "Payment intent unavailable" }, 503);
        }

        const { data: racedKeyIntent, error: racedKeyError } = await supabase
          .from("payment_intents")
          .select(intentColumns)
          .eq("user_id", auth.user.id)
          .eq("idempotency_key", input.idempotency_key)
          .maybeSingle();

        if (racedKeyError) return jsonResponse({ error: "Payment intent recovery unavailable" }, 503);

        let recoveredIntent = racedKeyIntent as PaymentIntent | null;
        if (!recoveredIntent) {
          const { data: racedActiveIntent, error: racedActiveError } = await supabase
            .from("payment_intents")
            .select(intentColumns)
            .eq("user_id", auth.user.id)
            .eq("pre_order_id", input.pre_order_id)
            .in("status", ["created", "pending", "processing"])
            .maybeSingle();

          if (racedActiveError) return jsonResponse({ error: "Active payment recovery unavailable" }, 503);
          recoveredIntent = racedActiveIntent as PaymentIntent | null;
        }

        if (!recoveredIntent || !matchesIntent(recoveredIntent, auth.user.id, input.pre_order_id, input.provider_id, amount)) {
          return jsonResponse({ error: "An active payment attempt already exists for this order" }, 409);
        }
        intent = recoveredIntent;
      } else {
        intent = insertedIntent as PaymentIntent;
      }
    }
  }

  if (!intent || !matchesIntent(intent, auth.user.id, input.pre_order_id, input.provider_id, amount)) {
    return jsonResponse({ error: "Payment intent validation failed" }, 409);
  }

  if (intent.provider_reference) {
    return jsonResponse({
      intent_id: intent.id,
      pre_order_id: intent.pre_order_id,
      amount: normalizePaymentAmount(String(intent.amount)),
      currency: intent.currency,
      status: intent.status,
      checkout_url: intent.checkout_url,
    }, 200);
  }

  if (intent.status !== "created") {
    return jsonResponse({ error: "Payment attempt is not ready for provider checkout" }, 409);
  }

  const returnUrl = Deno.env.get("PAYMENT_RETURN_URL");
  if (!returnUrl) return jsonResponse({ error: "Payment return URL is not configured" }, 503);

  let created: Awaited<ReturnType<typeof paymentProviderRegistry.createCheckout>>;
  try {
    created = await paymentProviderRegistry.createCheckout(input.provider_id, {
      intentId: intent.id,
      idempotencyKey: intent.idempotency_key,
      amount,
      currency: "AOA",
      description: "Pagamento AgriLink " + input.pre_order_id,
      returnUrl,
    });
  } catch (error) {
    console.error("Payment provider checkout creation failed:", error instanceof Error ? error.message : String(error));
    return jsonResponse({ error: "Payment provider checkout unavailable" }, 502);
  }

  const { data: updatedIntent, error: updateError } = await supabase
    .from("payment_intents")
    .update({
      provider_reference: created.providerReference,
      checkout_url: created.checkoutUrl ?? null,
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", intent.id)
    .eq("status", "created")
    .is("provider_reference", null)
    .select(intentColumns)
    .maybeSingle();

  if (updateError) return jsonResponse({ error: "Payment intent update unavailable" }, 503);

  const finalIntent = (updatedIntent as PaymentIntent | null) ?? intent;
  return jsonResponse({
    intent_id: finalIntent.id,
    pre_order_id: finalIntent.pre_order_id,
    amount: normalizePaymentAmount(String(finalIntent.amount)),
    currency: finalIntent.currency,
    status: finalIntent.status,
    checkout_url: finalIntent.checkout_url ?? created.checkoutUrl ?? null,
  }, 200);
});
