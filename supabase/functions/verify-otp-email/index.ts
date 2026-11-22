import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { z } from "npm:zod@3.23.8";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";

const BodySchema = z.object({
  email: z.string().trim().email().max(255),
  code: z.string().trim().regex(/^\d{6}$/),
});

const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const EMAIL_MAX_ATTEMPTS = 5;
const IP_MAX_ATTEMPTS = 20;

const sha256 = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const getClientIp = (req: Request): string =>
  req.headers.get("cf-connecting-ip")?.trim()
  || req.headers.get("x-real-ip")?.trim()
  || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  || "unknown";

const consumeRateLimit = async (
  supabaseUrl: string,
  serviceKey: string,
  bucketKey: string,
  maxRequests: number,
): Promise<boolean> => {
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
    throw new Error("Não foi possível validar o limite de tentativas.");
  }

  return (await response.json()) === true;
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return jsonResponse({ error: "Email ou código inválido." }, 400);
    }

    const email = parsed.data.email.trim().toLowerCase();
    const code = parsed.data.code;
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Configuração interna indisponível.");
    }

    const emailHash = await sha256(`otp-verify:email:${email}`);
    const ipHash = await sha256(`otp-verify:ip:${getClientIp(req)}`);
    const [emailAllowed, ipAllowed] = await Promise.all([
      consumeRateLimit(
        supabaseUrl,
        serviceKey,
        `auth:otp-verify:email:${emailHash}`,
        EMAIL_MAX_ATTEMPTS,
      ),
      consumeRateLimit(
        supabaseUrl,
        serviceKey,
        `auth:otp-verify:ip:${ipHash}`,
        IP_MAX_ATTEMPTS,
      ),
    ]);

    if (!emailAllowed || !ipAllowed) {
      return jsonResponse({
        success: false,
        error: "Atingiste o limite de tentativas. Solicita um novo código mais tarde.",
      }, 429);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const codeHash = await sha256(`email-otp:${email}:${code}`);

    const { data: userId, error: consumeError } = await supabase.rpc(
      "consume_email_verification_code",
      {
        p_email: email,
        p_code_hash: codeHash,
        p_legacy_code: code,
      },
    );

    if (consumeError) {
      console.error("Falha ao consumir código de verificação:", consumeError.message);
      throw new Error("Não foi possível concluir a verificação.");
    }

    if (typeof userId !== "string" || !userId) {
      return jsonResponse({ error: "Código incorreto, expirado ou já utilizado." }, 400);
    }

    const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });

    if (authError && !authError.message.toLowerCase().includes("already confirmed")) {
      console.error("Falha ao confirmar email no Auth:", authError.message);
      return jsonResponse({
        error: "Não foi possível confirmar a conta. Solicita um novo código.",
      }, 500);
    }

    const { error: profileError } = await supabase
      .from("users")
      .update({ email_verified: true, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (profileError) {
      console.warn("O trigger de confirmação deve sincronizar o perfil:", profileError.message);
    }

    return jsonResponse({ success: true, message: "Email confirmado com sucesso." });
  } catch (error) {
    console.error(
      "verify-otp-email falhou:",
      error instanceof Error ? error.message : "erro desconhecido",
    );
    return jsonResponse({
      error: "Não foi possível verificar o código. Tenta novamente mais tarde.",
    }, 500);
  }
});
