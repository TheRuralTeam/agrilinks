import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { z } from "npm:zod@3.23.8";
import { buildBrandEmailTemplate, escapeHtml, sendResendEmail } from "../_shared/email.ts";
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

    const fullName = escapeHtml(userRow.full_name || parsed.data.full_name || "Utilizador AgriLink");
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

    const html = buildBrandEmailTemplate({
      title: "Código de verificação — AgriLink",
      preheader: "O código para confirmar o teu email na AgriLink.",
      headline: "Confirma o teu email",
      bodyHtml: [
        `<p style="margin:0 0 16px;">Olá ${fullName},</p>`,
        '<p style="margin:0 0 22px;">Introduz o código abaixo para confirmar o teu endereço de email.</p>',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td align="center" style="padding:20px 12px;background:#f1f7f0;border:1px solid #dce9dc;border-radius:6px;color:#176b3a;font-family:Arial,Helvetica,sans-serif;font-size:32px;line-height:40px;font-weight:700;letter-spacing:8px;">${otpCode}</td></tr></table>`,
        '<p style="margin:0 0 12px;font-size:13px;line-height:21px;color:#526158;">O código é válido durante 15 minutos.</p>',
        '<p style="margin:0;font-size:13px;line-height:21px;color:#526158;">Se não pediste este código, ignora este email.</p>',
      ].join(""),
    });

    try {
      await sendResendEmail({
        to: email,
        subject: "Código de verificação — AgriLink",
        html,
        from: "AgriLink <no-reply@agrilink.ao>",
        replyTo: "contacto@agrilink.ao",
      });
    } catch (sendError) {
      await supabase.from("email_verification_codes")
        .update({ verified: true })
        .eq("email", email)
        .eq("code", otpCode);
      throw sendError;
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
