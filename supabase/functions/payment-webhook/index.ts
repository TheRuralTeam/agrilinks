import { supabase } from "../_shared/supabase.ts";
import { paymentProviderRegistry } from "../_shared/payments/registry.ts";
import { createPaymentWebhookHandler } from "../_shared/payments/webhookHandler.ts";

Deno.serve(createPaymentWebhookHandler(paymentProviderRegistry, async (event) => {
  const { data, error } = await supabase.rpc("apply_wallet_payment_webhook", {
    p_provider_id: event.providerId,
    p_provider_event_id: event.providerEventId,
    p_event_type: event.eventType,
    p_body_sha256: event.bodySha256,
    p_provider_reference: event.providerReference,
    p_provider_status: event.providerStatus,
    p_amount: event.amount,
    p_currency: event.currency,
  });

  return { data: typeof data === "string" ? data : null, error };
}));