import { z } from "npm:zod@3.23.8";
import { jsonResponse } from "../_shared/http.ts";
import {
  buildBrandEmailTemplate,
  escapeHtml,
  normalizeEmail,
  sendResendEmail,
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

    const phone = escapeHtml(parsed.data.phone?.trim() || "Não indicado");
    const message = escapeHtml(parsed.data.message.trim()).replace(/\n/g, "<br />");
    const name = escapeHtml(parsed.data.name.trim());

    const html = buildBrandEmailTemplate({
      title: "Nova mensagem de suporte — AgriLink",
      preheader: "Recebeu uma nova mensagem do portal de suporte da AgriLink.",
      headline: "Nova mensagem de suporte",
      bodyHtml: `
        <p style="margin:0 0 12px;"><strong>Nome:</strong> ${name}</p>
        <p style="margin:0 0 12px;"><strong>Email:</strong> ${escapeHtml(fromEmail)}</p>
        <p style="margin:0 0 12px;"><strong>Telefone:</strong> ${phone}</p>
        <p style="margin:0 0 12px;"><strong>Mensagem:</strong></p>
        <p style="margin:0 0 12px;">${message}</p>
      `,
      secondaryText: "Mensagem recebida através do formulário de contacto da AgriLink.",
    });

    const result = await sendResendEmail({
      to: "contacto@agrilink.ao",
      subject: `Suporte AgriLink — ${name}`,
      html,
      replyTo: fromEmail,
    });

    return jsonResponse({
      success: true,
      message: "Mensagem enviada ao suporte com sucesso.",
      email: fromEmail,
      resend_id: result?.id ?? null,
    }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno ao enviar suporte.";
    console.error("send-support-email failed:", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
