import { z } from "npm:zod@3.23.8";
import { jsonResponse } from "../_shared/http.ts";
import {
  normalizeEmail,
} from "../_shared/email.ts";

const BodySchema = z.object({
  name: z.string().trim().min(2).max(120).refine((value) => !/[\r\n]/.test(value)),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(50).optional(),
  message: z.string().trim().min(10).max(5000),
});

const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const EMAIL_MAX_REQUESTS = 5;
const IP_MAX_REQUESTS = 10;

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const getClientIp = (req: Request) =>
  req.headers.get("cf-connecting-ip")?.trim()
  || req.headers.get("x-real-ip")?.trim()
  || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  || "unknown";

const consumeRateLimit = async (supabaseUrl: string, serviceKey: string, bucketKey: string, maxRequests: number) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_api_rate_limit`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_bucket_key: bucketKey,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      p_max_requests: maxRequests,
    }),
  });
  if (!response.ok) throw new Error("Não foi possível validar o limite de envio.");
  return (await response.json()) === true;
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return jsonResponse({ ok: true }, 200);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  try {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);

    if (!parsed.success) {
      return jsonResponse({ error: "Dados inválidos para contacto de suporte." }, 400);
    }

    const fromEmail = normalizeEmail(parsed.data.email);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Configuração interna indisponível.");

    const emailHash = await sha256(`support:email:${fromEmail}`);
    const ipHash = await sha256(`support:ip:${getClientIp(req)}`);
    const emailAllowed = await consumeRateLimit(supabaseUrl, serviceKey, `support:email:${emailHash}`, EMAIL_MAX_REQUESTS);
    const ipAllowed = await consumeRateLimit(supabaseUrl, serviceKey, `support:ip:${ipHash}`, IP_MAX_REQUESTS);
    if (!emailAllowed || !ipAllowed) {
      return jsonResponse({ success: false, error: "Atingiste o limite de mensagens. Tenta novamente mais tarde." }, 429);
    }

    const name = parsed.data.name.trim();
    const dedupeWindow = Math.floor(Date.now() / 60_000);
    const messageHash = await sha256(`support:${fromEmail}:${name}:${parsed.data.phone || ""}:${parsed.data.message.trim()}:${dedupeWindow}`);
    const queueResponse = await fetch(`${supabaseUrl}/rest/v1/email_outbox`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal,resolution=ignore-duplicates",
      },
      body: JSON.stringify({
        dedupe_key: `support:${messageHash}`,
        recipient: "contacto@agrilink.ao",
        subject: `Suporte AgriLink — ${name}`,
        template: "support-contact",
        priority: 60,
        payload: {
          name,
          email: fromEmail,
          phone: parsed.data.phone?.trim() || "Não indicado",
          message: parsed.data.message.trim(),
          reply_to: fromEmail,
        },
      }),
    });

    if (!queueResponse.ok) {
      const queueError = await queueResponse.text().catch(() => "");
      console.error("Falha ao colocar mensagem de suporte na fila:", queueError);
      throw new Error("Não foi possível agendar a mensagem de suporte.");
    }

    return jsonResponse({
      success: true,
      queued: true,
      message: "Mensagem recebida e colocada na fila de suporte.",
      email: fromEmail,
    }, 202);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno ao enviar suporte.";
    console.error("send-support-email failed:", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
