import { z } from "npm:zod@3.23.8";
import { jsonResponse } from "../_shared/http.ts";
import { normalizeEmail, safeRedirect } from "../_shared/email.ts";

const BodySchema = z.object({
  email: z.string().trim().email().max(255),
  full_name: z.string().trim().min(1).max(120).optional(),
  redirect_to: z.string().trim().url().max(500).optional(),
});

const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const EMAIL_MAX_REQUESTS = 3;
const IP_MAX_REQUESTS = 20;

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const getClientIp = (req: Request) => {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  const cloudflareIp = req.headers.get("cf-connecting-ip")?.trim();
  return cloudflareIp || forwarded || realIp || "unknown";
};

const consumeRateLimit = async (bucketKey: string, maxRequests: number) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Configuração interna de rate limit indisponível.");
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/rpc/consume_api_rate_limit`,
    {
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
    },
  );

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error("consume_api_rate_limit failed:", details);
    throw new Error("Não foi possível validar o limite de envio.");
  }

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
      return jsonResponse({ error: "Dados inválidos para confirmação de conta." }, 400);
    }

    const email = normalizeEmail(parsed.data.email);
    const emailHash = await sha256(`confirmation-email:${email}`);
    const ipHash = await sha256(`confirmation-ip:${getClientIp(req)}`);

    const emailAllowed = await consumeRateLimit(
      `auth:confirmation:email:${emailHash}`,
      EMAIL_MAX_REQUESTS,
    );

    if (!emailAllowed) {
      return jsonResponse({
        success: false,
        error: "Limite de pedidos de confirmação atingido. Tente novamente mais tarde.",
      }, 429);
    }

    const ipAllowed = await consumeRateLimit(
      `auth:confirmation:ip:${ipHash}`,
      IP_MAX_REQUESTS,
    );

    if (!ipAllowed) {
      return jsonResponse({
        success: false,
        error: "Muitos pedidos de confirmação a partir desta rede. Tente novamente mais tarde.",
      }, 429);
    }

    const fullName = parsed.data.full_name?.trim() || "Agricultor";
    const redirectTo = safeRedirect(parsed.data.redirect_to, "https://agrilink.ao/auth/callback?next=%2Fapp");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const [queued, queueOk] = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/rest/v1/email_outbox`,
      {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation,resolution=ignore-duplicates",
        },
        body: JSON.stringify({
          dedupe_key: `auth:signup:${email}:${Math.floor(Date.now() / 60000)}`,
          recipient: email,
          subject: "Confirme a sua conta — AgriLink",
          template: "auth-signup",
          priority: 100,
          payload: { full_name: fullName, redirect_to: redirectTo, email },
        }),
      },
    ).then(async (response) => [await response.json().catch(() => null), response.ok] as const);

    if (!queueOk) {
      throw new Error(queued?.message || "Não foi possível agendar a confirmação.");
    }

    return jsonResponse({
      success: true,
      queued: true,
      message: "Confirmação agendada para envio.",
      email,
    }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno ao enviar confirmação.";
    console.error("send-confirmation-email failed:", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
