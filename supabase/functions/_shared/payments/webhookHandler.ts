import { jsonResponse } from "../http.ts";
import { sha256Hex } from "./crypto.ts";
import { PaymentProviderRegistry } from "./provider.ts";

const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;

export type ApplyPaymentWebhook = (event: {
  providerId: string;
  providerEventId: string;
  eventType: string;
  bodySha256: string;
  providerReference: string;
  providerStatus: string;
  amount: string;
  currency: string;
}) => Promise<{ data: string | null; error: { message: string } | null }>;

export function createPaymentWebhookHandler(
  registry: PaymentProviderRegistry,
  applyPaymentWebhook: ApplyPaymentWebhook,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204 });
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const providerId = new URL(request.url).pathname.split("/").filter(Boolean).at(-1);
    if (!providerId || !registry.has(providerId)) {
      return jsonResponse({ error: "Payment provider is not configured" }, 503);
    }

    let rawBody: ArrayBuffer;
    try {
      const boundedRequest = await withBoundedBody(request, MAX_WEBHOOK_BODY_BYTES);
      rawBody = await boundedRequest.arrayBuffer();
    } catch {
      return jsonResponse({ error: "Webhook payload too large or unreadable" }, 413);
    }

    let event;
    let rawBodyHash: string;
    try {
      rawBodyHash = await sha256Hex(rawBody);
      const verificationRequest = new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: rawBody.slice(0),
      });
      event = await registry.verifyWebhook(providerId, verificationRequest);
    } catch {
      return jsonResponse({ error: "Webhook verification failed" }, 401);
    }
    if (event.bodySha256 !== rawBodyHash) {
      return jsonResponse({ error: "Webhook body verification failed" }, 401);
    }

    let result: Awaited<ReturnType<ApplyPaymentWebhook>>;
    try {
      result = await applyPaymentWebhook({
        providerId,
        providerEventId: event.eventId,
        eventType: event.eventType,
        bodySha256: rawBodyHash,
        providerReference: event.providerReference,
        providerStatus: event.status,
        amount: event.amount,
        currency: event.currency,
      });
    } catch {
      return jsonResponse({ error: "Webhook processing unavailable" }, 503);
    }
    const { data, error } = result;

    if (error) {
      console.error("Payment webhook persistence failed:", error.message);
      return jsonResponse({ error: "Webhook processing unavailable" }, 503);
    }

    if (data === "retry") {
      return new Response(JSON.stringify({ error: "Payment intent not ready" }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Retry-After": "10" },
      });
    }
    if (data === "duplicate_payload_mismatch") {
      return jsonResponse({ error: "Webhook event id reused with different payload" }, 409);
    }
    if (data === "rejected") {
      return jsonResponse({ error: "Webhook does not match a valid payment" }, 422);
    }
    if (!["processed", "duplicate", "ignored"].includes(data ?? "")) {
      return jsonResponse({ error: "Unexpected webhook processing result" }, 503);
    }

    return jsonResponse({ received: true, outcome: data }, 200);
  };
}

export async function withBoundedBody(request: Request, maxBytes: number): Promise<Request> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("Request body too large");
  }

  if (!request.body) return request;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error("Request body too large");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  return new Request(request.url, {
    method: request.method,
    headers,
    body,
  });
}