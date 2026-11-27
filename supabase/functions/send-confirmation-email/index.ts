import { createClient } from "npm:@supabase/supabase-js@2.57.4";
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
  const cloudflareIp = req.headers.get("cf-connecting-ip")?.trim();
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  return cloudflareIp || forwarded || realIp || "unknown";
};

const consumeRateLimit = async (bucketKey: string, maxRequests: number) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Configuração interna de rate limit indisponível.");
  }

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

  if (!response.ok) {
    console.error("consume_api_rate_limit failed with status:", response.status);
    throw new Error("Não foi possível validar o limite de envio.");
  }

  return (await response.json()) === true;
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true }, 200);
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  try {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return jsonResponse({ success: false, error: "Dados inválidos para confirmação de conta." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !anonKey || !Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      console.error("Configuração necessária para reenvio de confirmação indisponível.");
      return jsonResponse({ success: false, error: "Serviço de confirmação temporariamente indisponível." }, 503);
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

    const redirectTo = safeRedirect(
      parsed.data.redirect_to,
      "https://agrilink.ao/auth/callback?next=%2Fapp",
    );

    // Supabase Auth owns signup confirmation tokens. Its supported resend endpoint
    // is the only safe way to re-issue a confirmation for an existing unconfirmed user.
    // Delivery requires a configured custom SMTP provider in the Supabase Auth settings.
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await authClient.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      const status = error.status === 429 ? 429 : 502;
      console.warn("Supabase Auth rejected confirmation resend:", {
        status: error.status,
        code: "code" in error ? error.code : undefined,
      });
      return jsonResponse({
        success: false,
        error: status === 429
          ? "O limite de reenvio do serviço de autenticação foi atingido. Aguarde antes de tentar novamente."
          : "O serviço de autenticação não aceitou o pedido de confirmação. Tente novamente mais tarde.",
      }, status);
    }

    return jsonResponse({
      success: true,
      accepted: true,
      provider: "supabase-auth",
      message: "O serviço de autenticação aceitou o pedido de confirmação.",
    }, 202);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno ao solicitar confirmação.";
    console.error("send-confirmation-email failed:", message);
    return jsonResponse({
      success: false,
      error: "Não foi possível solicitar a confirmação neste momento.",
    }, 500);
  }
});
