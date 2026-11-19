import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { z } from "npm:zod@3.23.8";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";

const BodySchema = z.object({
  user_id: z.string().uuid().optional(),
  email: z.string().trim().email().max(255),
  full_name: z.string().trim().min(1).max(120).optional(),
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

  if (!response.ok) {
    console.error("Limite de envio OTP indisponível:", response.status);
    throw new Error("Não foi possível validar o limite de envio.");
  }

  return (await response.json()) === true;
};

const createOtpCode = () => {
  const range = 0x100000000;
  const ceiling = Math.floor(range / 1_000_000) * 1_000_000;
  const values = new Uint32Array(1);
  do {
    crypto.getRandomValues(values);
  } while (values[0] >= ceiling);
  return String(values[0] % 1_000_000).padStart(6, "0");
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonResponse({ error: "Dados inválidos para verificação do email." }, 400);

    const email = parsed.data.email.trim().toLowerCase();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Configuração interna indisponível.");

    const emailHash = await sha256(`otp:email:${email}`);
    const ipHash = await sha256(`otp:ip:${getClientIp(req)}`);
    const emailAllowed = await consumeRateLimit(supabaseUrl, serviceKey, `auth:otp:email:${emailHash}`, EMAIL_MAX_REQUESTS);
    const ipAllowed = await consumeRateLimit(supabaseUrl, serviceKey, `auth:otp:ip:${ipHash}`, IP_MAX_REQUESTS);
    if (!emailAllowed || !ipAllowed) {
      return jsonResponse({
        success: false,
        error: "Atingiste o limite de pedidos de código. Tenta novamente mais tarde.",
      }, 429);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id, full_name, email")
      .eq("email", email)
      .maybeSingle();

    if (userError) {
      console.error("Falha ao validar a conta para OTP:", userError.message);
      throw new Error("Não foi possível processar o pedido de verificação.");
    }

    // Não revelar se um endereço está registado nem aceitar um user_id associado a outro email.
    if (!userRow?.id || (parsed.data.user_id && parsed.data.user_id !== userRow.id)) {
      return jsonResponse({
        success: true,
        message: "Se a conta estiver registada, receberás um código de verificação por email.",
      });
    }

    const otpCode = createOtpCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: invalidateError } = await supabase
      .from("email_verification_codes")
      .update({ verified: true })
      .eq("email", email)
      .eq("verified", false);

    if (invalidateError) {
      console.error("Falha ao invalidar códigos OTP anteriores:", invalidateError.message);
      throw new Error("Não foi possível preparar a verificação do email.");
    }

    const { error: insertError } = await supabase.from("email_verification_codes").insert({
      user_id: userRow.id,
      email,
      code: otpCode,
      expires_at: expiresAt,
      verified: false,
    });

    if (insertError) {
      console.error("Falha ao guardar código OTP:", insertError.message);
      throw new Error("Não foi possível preparar a verificação do email.");
    }

    const queueResponse = await fetch(`${supabaseUrl}/rest/v1/email_outbox`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal,resolution=ignore-duplicates",
      },
      body: JSON.stringify({
        dedupe_key: `auth:otp:${userRow.id}:${crypto.randomUUID()}`,
        recipient: email,
        subject: "Código de verificação — AgriLink",
        template: "auth-otp",
        priority: 100,
        scheduled_at: new Date().toISOString(),
        payload: {
          full_name: userRow.full_name || parsed.data.full_name || "Utilizador AgriLink",
          otp_code: otpCode,
          expires_at: expiresAt,
        },
      }),
    });

    if (!queueResponse.ok) {
      const queueError = await queueResponse.text().catch(() => "");
      await supabase.from("email_verification_codes")
        .update({ verified: true })
        .eq("email", email)
        .eq("code", otpCode);
      console.error("Falha ao colocar OTP na fila:", queueError);
      throw new Error("Não foi possível agendar o código de verificação.");
    }

    return jsonResponse({
      success: true,
      message: "Se a conta estiver registada, receberás um código de verificação por email.",
    });
  } catch (error) {
    console.error("send-otp-email falhou:", error instanceof Error ? error.message : "erro desconhecido");
    return jsonResponse({ error: "Não foi possível enviar o código de verificação. Tenta novamente mais tarde." }, 500);
  }
});
