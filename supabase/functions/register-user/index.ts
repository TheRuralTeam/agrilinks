import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { z } from "npm:zod@3.23.8";
import { buildBrandEmailTemplate, escapeHtml, sendResendEmail } from "../_shared/email.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";

const UserTypeSchema = z.enum(["agricultor", "agente", "comprador", "motorista"]);
const BodySchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128).optional(),
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(3).max(40),
  user_type: UserTypeSchema.optional(),
  identity_document: z.string().trim().max(120).optional().nullable(),
  province_id: z.string().trim().max(100).optional().nullable(),
  municipality_id: z.string().trim().max(100).optional().nullable(),
  load_capacity_kg: z.number().positive().max(100000).optional().nullable(),
  referred_by_agent_code: z.string().trim().regex(/^[A-Za-z0-9]{6}$/).optional().nullable(),
});

const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const EMAIL_MAX_REQUESTS = 3;
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

  if (!response.ok) {
    console.error("Limite de registo indisponível:", response.status);
    throw new Error("Não foi possível validar o limite de registos.");
  }

  return (await response.json()) === true;
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return jsonResponse({ error: "Verifica os dados introduzidos. A palavra-passe deve ter pelo menos 8 caracteres." }, 400);
    }

    const input = parsed.data;
    const email = input.email.trim().toLowerCase();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Configuração interna indisponível.");

    const emailHash = await sha256(`register:email:${email}`);
    const ipHash = await sha256(`register:ip:${getClientIp(req)}`);
    const emailAllowed = await consumeRateLimit(supabaseUrl, serviceKey, `auth:register:email:${emailHash}`, EMAIL_MAX_REQUESTS);
    const ipAllowed = await consumeRateLimit(supabaseUrl, serviceKey, `auth:register:ip:${ipHash}`, IP_MAX_REQUESTS);
    if (!emailAllowed || !ipAllowed) {
      return jsonResponse({ error: "Atingiste o limite de tentativas de registo. Tenta novamente mais tarde." }, 429);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const referralCode = input.referred_by_agent_code?.trim().toUpperCase() || null;
    if (referralCode) {
      const { data: agent, error: agentError } = await supabase
        .from("users")
        .select("id")
        .eq("user_type", "agente")
        .eq("agent_code", referralCode)
        .maybeSingle();

      if (agentError) {
        console.error("Falha ao validar código de agente:", agentError.message);
        throw new Error("Não foi possível validar o código de agente.");
      }
      if (!agent) return jsonResponse({ error: "O código de agente não é válido." }, 400);
    }

    const redirectTo = "https://agrilink.ao/auth/callback?next=%2Fapp";
    const metadata: Record<string, unknown> = {
      full_name: input.full_name.trim(),
      phone: input.phone.trim(),
      identity_document: input.identity_document?.trim() || null,
      user_type: input.user_type || null,
      province_id: input.province_id || null,
      municipality_id: input.municipality_id || null,
      load_capacity_kg: input.load_capacity_kg ?? null,
      referred_by_agent_code: referralCode,
    };

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "signup",
      email,
      ...(input.password ? { password: input.password } : {}),
      options: { data: metadata, redirectTo },
    });

    if (error || !data?.user?.id || !data.properties?.hashed_token) {
      const providerMessage = error?.message || "O serviço de autenticação não devolveu o link de confirmação.";
      console.error("Falha ao criar conta AgriLink:", providerMessage);
      if (/already registered|already been registered|user already exists/i.test(providerMessage)) {
        return jsonResponse({ error: "Este email já está registado. Inicia sessão ou recupera a palavra-passe." }, 409);
      }
      return jsonResponse({ error: "Não foi possível criar a conta. Tenta novamente mais tarde." }, 400);
    }

    const actionUrl = new URL(redirectTo);
    actionUrl.searchParams.set("token_hash", data.properties.hashed_token);
    actionUrl.searchParams.set("type", "signup");

    const safeName = escapeHtml(input.full_name.trim());
    const html = buildBrandEmailTemplate({
      title: "Confirma a tua conta — AgriLink",
      preheader: "Confirma o teu endereço de email para activar a conta AgriLink.",
      headline: "Confirma a tua conta",
      bodyHtml: `<p style="margin:0 0 14px;">Olá ${safeName},</p><p style="margin:0;">Confirma o teu endereço de email para activar a tua conta AgriLink e começar a utilizar a plataforma.</p>`,
      ctaText: "Confirmar a conta",
      ctaHref: actionUrl.toString(),
      secondaryText: "Se não criaste esta conta, ignora esta mensagem.",
    });

    let confirmationSent = true;
    try {
      await sendResendEmail({
        to: email,
        subject: "Confirma a tua conta — AgriLink",
        html,
        from: "AgriLink <no-reply@agrilink.ao>",
        replyTo: "contacto@agrilink.ao",
      });
    } catch (sendError) {
      confirmationSent = false;
      console.error("Conta criada, mas o email de confirmação não foi enviado:", sendError instanceof Error ? sendError.message : "erro desconhecido");
    }

    return jsonResponse({
      success: true,
      confirmation_sent: confirmationSent,
      user: { id: data.user.id, email },
      message: confirmationSent
        ? "Conta criada. Enviámos um email para confirmares o teu endereço."
        : "A conta foi criada, mas não foi possível enviar o email. Usa a opção de reenviar confirmação.",
    }, confirmationSent ? 200 : 202);
  } catch (error) {
    console.error("register-user falhou:", error instanceof Error ? error.message : "erro desconhecido");
    return jsonResponse({ error: "Não foi possível concluir o registo. Tenta novamente mais tarde." }, 500);
  }
});
