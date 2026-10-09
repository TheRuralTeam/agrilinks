import { z } from "npm:zod@3.23.8";
import { jsonResponse } from "../_shared/http.ts";
import { normalizeEmail, safeRedirect } from "../_shared/email.ts";

const BodySchema = z.object({
  email: z.string().trim().email().max(255),
  redirect_to: z.string().trim().url().max(500).optional(),
});

const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const EMAIL_MAX_REQUESTS = 3;
const IP_MAX_REQUESTS = 20;

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
      return jsonResponse({ error: "Dados inválidos para recuperação de password." }, 400);
    }

    const email = normalizeEmail(parsed.data.email);
    const redirectTo = safeRedirect(parsed.data.redirect_to, "https://agrilink.ao/auth/callback?next=%2Freset-password");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) throw new Error("Configuração interna indisponível.");

    const emailHash = await sha256(`recovery:email:${email}`);
    const ipHash = await sha256(`recovery:ip:${getClientIp(req)}`);
    const emailAllowed = await consumeRateLimit(supabaseUrl, serviceKey, `auth:recovery:email:${emailHash}`, EMAIL_MAX_REQUESTS);
    const ipAllowed = await consumeRateLimit(supabaseUrl, serviceKey, `auth:recovery:ip:${ipHash}`, IP_MAX_REQUESTS);
    if (!emailAllowed || !ipAllowed) {
      return jsonResponse({ success: false, error: "Atingiste o limite de pedidos de recuperação. Tenta novamente mais tarde." }, 429);
    }

    const [queued, queueOk] = await fetch(`${supabaseUrl}/rest/v1/email_outbox`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation,resolution=ignore-duplicates",
      },
      body: JSON.stringify({
        dedupe_key: `auth:recovery:${email}:${Math.floor(Date.now() / 60000)}`,
        recipient: email,
        subject: "Recuperar a palavra-passe — AgriLink",
        template: "auth-recovery",
        priority: 100,
        payload: { redirect_to: redirectTo, email },
      }),
    }).then(async (response) => [await response.json().catch(() => null), response.ok] as const);
    if (!queueOk) throw new Error(queued?.message || "Não foi possível agendar a recuperação.");

    return jsonResponse({
      success: true,
      queued: true,
      message: "Recuperação agendada para envio.",
      email,
    }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno ao enviar recuperação.";
    console.error("send-password-reset failed:", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
