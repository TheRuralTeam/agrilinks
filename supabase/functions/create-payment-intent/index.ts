import { z } from "npm:zod@3.23.8";
import { handleCors, jsonResponse } from "../_shared/http.ts";
import { supabase } from "../_shared/supabase.ts";
import { paymentProviderRegistry } from "../_shared/payments/registry.ts";
import { withBoundedBody } from "../_shared/payments/webhookHandler.ts";
import { normalizePaymentAmount } from "../_shared/payments/money.ts";

const RequestSchema = z.object({
  provider_id: z.string().regex(/^[a-z][a-z0-9_-]{1,49}$/),
  idempotency_key: z.string().uuid(),
  amount: z.string().transform((amount, context) => {
    try {
      return normalizePaymentAmount(amount);
    } catch {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid amount" });
      return z.NEVER;
    }
  }),
  currency: z.literal("AOA"),
}).strict();

interface PaymentIntentRecord {
  id: string;
  user_id: string;
  wallet_id: string;
  provider_id: string;
  idempotency_key: string;
  provider_reference: string | null;
  amount: number;
  amount_text: string;
  currency: string;
  status: "created" | "pending" | "processing" | "succeeded" | "failed" | "cancelled" | "expired" | "refunded";
}

Deno.serve(async (request: Request): Promise<Response> => {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  const authorization = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(.+)$/i.exec(authorization)?.[1];
  if (!token) return jsonResponse({ error: "Authentication required" }, 401);

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return jsonResponse({ error: "Authentication required" }, 401);

  let input;
  try {
    const boundedRequest = await withBoundedBody(request, 16 * 1024);
    const parsed = RequestSchema.safeParse(await boundedRequest.json());
    if (!parsed.success) return jsonResponse({ error: "Invalid payment request" }, 400);
    input = parsed.data;
  } catch {
    return jsonResponse({ error: "Invalid or oversized payment request" }, 400);
  }

  if (!paymentProviderRegistry.has(input.provider_id)) {
    return jsonResponse({ error: "Payment provider is not configured" }, 503);
  }

  const maxRequests = Number(Deno.env.get("PAYMENT_INTENT_RATE_LIMIT_MAX"));
  const rateWindowSeconds = Number(Deno.env.get("PAYMENT_INTENT_RATE_WINDOW_SECONDS"));
  if (!Number.isInteger(maxRequests) || !Number.isInteger(rateWindowSeconds)) {
    return jsonResponse({ error: "Payment rate limit is not configured" }, 503);
  }
  const { data: withinRateLimit, error: rateLimitError } = await supabase.rpc(
    "consume_payment_intent_rate_limit",
    {
      p_user_id: authData.user.id,
      p_max_requests: maxRequests,
      p_window_seconds: rateWindowSeconds,
    },
  );
  if (rateLimitError) return jsonResponse({ error: "Payment rate limit unavailable" }, 503);
  if (!withinRateLimit) {
    return new Response(JSON.stringify({ error: "Payment request rate limit exceeded" }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(rateWindowSeconds) },
    });
  }

  const returnUrlValue = Deno.env.get("PAYMENT_RETURN_URL");
  let returnUrl: URL;
  try {
    returnUrl = new URL(returnUrlValue ?? "");
    if (returnUrl.protocol !== "https:" || returnUrl.username || returnUrl.password) {
      throw new Error("Invalid return URL");
    }
  } catch {
    return jsonResponse({ error: "Payment return URL is not configured" }, 503);
  }

  const { data: wallet, error: walletError } = await supabase
    .from("wallets")
    .select("id")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (walletError) return jsonResponse({ error: "Wallet lookup unavailable" }, 503);
  if (!wallet) return jsonResponse({ error: "Wallet not found" }, 404);

  const intentValues = {
    user_id: authData.user.id,
    wallet_id: wallet.id,
    provider_id: input.provider_id,
    idempotency_key: input.idempotency_key,
    amount: input.amount,
    currency: input.currency,
  };

  const { data: insertedIntent, error: insertError } = await supabase
    .from("payment_intents")
    .upsert(intentValues, {
      onConflict: "user_id,idempotency_key",
      ignoreDuplicates: true,
    })
    .select("id,user_id,wallet_id,provider_id,idempotency_key,provider_reference,amount_text:amount::text,currency,status")
    .maybeSingle();
  if (insertError) return jsonResponse({ error: "Payment intent unavailable" }, 503);

  let intent = insertedIntent as PaymentIntentRecord | null;
  if (!intent) {
    const { data, error } = await supabase
      .from("payment_intents")
      .select("id,user_id,wallet_id,provider_id,idempotency_key,provider_reference,amount_text:amount::text,currency,status")
      .eq("user_id", authData.user.id)
      .eq("idempotency_key", input.idempotency_key)
      .maybeSingle();
    if (error) return jsonResponse({ error: "Payment intent unavailable" }, 503);
    intent = data as PaymentIntentRecord | null;
  }

  if (!intent) return jsonResponse({ error: "Payment intent unavailable" }, 503);
  if (intent.provider_id !== input.provider_id
    || intent.wallet_id !== wallet.id
    || normalizePaymentAmount(intent.amount_text) !== input.amount
    || intent.currency !== input.currency) {
    return jsonResponse({ error: "Idempotency key already used for a different payment" }, 409);
  }

  if (["succeeded", "failed", "cancelled", "expired", "refunded"].includes(intent.status)) {
    return jsonResponse({ intent_id: intent.id, status: intent.status }, 200);
  }

  let checkout;
  try {
    checkout = await paymentProviderRegistry.createCheckout(input.provider_id, {
      intentId: intent.id,
      idempotencyKey: input.idempotency_key,
      amount: input.amount,
      currency: input.currency,
      description: "Carregamento da carteira AgriLink",
      returnUrl: returnUrl.toString(),
    });
  } catch {
    return jsonResponse({ error: "Payment provider unavailable" }, 502);
  }

  if (intent.provider_reference && intent.provider_reference !== checkout.providerReference) {
    return jsonResponse({ error: "Provider idempotency conflict" }, 409);
  }

  let updatedStatus = intent.status;
  if (!intent.provider_reference) {
    const { data: attachedIntent, error: updateError } = await supabase
      .from("payment_intents")
      .update({
        provider_reference: checkout.providerReference,
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", intent.id)
      .eq("status", "created")
      .is("provider_reference", null)
      .select("status, provider_reference")
      .maybeSingle();
    if (updateError) return jsonResponse({ error: "Payment intent update unavailable" }, 503);

    if (attachedIntent) {
      updatedStatus = attachedIntent.status;
    } else {
      const { data: currentIntent, error: readError } = await supabase
        .from("payment_intents")
        .select("status, provider_reference")
        .eq("id", intent.id)
        .maybeSingle();
      if (readError || !currentIntent) {
        return jsonResponse({ error: "Payment intent update unavailable" }, 503);
      }
      if (currentIntent.provider_reference !== checkout.providerReference) {
        return jsonResponse({ error: "Provider idempotency conflict" }, 409);
      }
      updatedStatus = currentIntent.status;
    }
  }

  return jsonResponse({
    intent_id: intent.id,
    status: updatedStatus,
    checkout_url: checkout.checkoutUrl ?? null,
  }, 200);
});