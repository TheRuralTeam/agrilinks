import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { jsonResponse } from "../_shared/http.ts";
import {
  buildBrandEmailTemplate,
  escapeHtml,
  normalizeEmail,
  safeRedirect,
  sendResendEmail,
} from "../_shared/email.ts";

const BodySchema = z.object({
  email: z.string().trim().email().max(255),
  customer_name: z.string().trim().min(2).max(120).optional(),
  order_id: z.string().trim().min(1).max(120),
  status: z.string().trim().min(2).max(120),
  message: z.string().trim().min(5).max(2500),
  redirect_to: z.string().trim().url().max(500).optional(),
});

const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const MAX_REQUESTS = 5;

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const getClientIp = (req: Request) =>
  req.headers.get("cf-connecting-ip")?.trim()
  || req.headers.get("x-real-ip")?.trim()
  || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  || "unknown";

const consumeRateLimit = async (supabaseUrl: string, serviceKey: string, bucketKey: string) => {
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
      p_max_requests: MAX_REQUESTS,
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
      return jsonResponse({ error: "Dados inválidos para atualização de encomenda." }, 400);
    }

    const authorization = req.headers.get("authorization") || "";
    const token = authorization.replace(/^Bearer\\s+/i, "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!token || !supabaseUrl || !serviceKey) {
      return jsonResponse({ success: false, error: "É necessário iniciar sessão para enviar esta notificação." }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const authenticatedEmail = normalizeEmail(authData.user?.email || "");
    const requestedEmail = normalizeEmail(parsed.data.email);
    if (authError || !authData.user?.id || !authenticatedEmail || requestedEmail !== authenticatedEmail) {
      return jsonResponse({ success: false, error: "Só podes enviar notificações para o email da tua própria conta." }, 403);
    }

    const userHash = await sha256(`order-email:user:${authData.user.id}`);
    const ipHash = await sha256(`order-email:ip:${getClientIp(req)}`);
    const userAllowed = await consumeRateLimit(supabaseUrl, serviceKey, `order-email:user:${userHash}`);
    const ipAllowed = await consumeRateLimit(supabaseUrl, serviceKey, `order-email:ip:${ipHash}`);
    if (!userAllowed || !ipAllowed) {
      return jsonResponse({ success: false, error: "Atingiste o limite de envio. Tenta novamente mais tarde." }, 429);
    }

    const email = authenticatedEmail;
    const metadataName = typeof authData.user.user_metadata?.full_name === "string" ? authData.user.user_metadata.full_name : "";
    const customerName = escapeHtml(metadataName || parsed.data.customer_name?.trim() || "Cliente");
    const redirectTo = safeRedirect(parsed.data.redirect_to, "https://agrilink.ao/app");

    const html = buildBrandEmailTemplate({
      title: `Atualização da encomenda ${parsed.data.order_id} — AgriLink`,
      preheader: `A sua encomenda ${parsed.data.order_id} teve uma atualização de estado.`,
      headline: `Encomenda ${parsed.data.order_id}`,
      bodyHtml: `
        <p style="margin:0 0 12px;">Olá ${customerName},</p>
        <p style="margin:0 0 12px;">O estado da sua encomenda foi atualizado para: <strong>${escapeHtml(parsed.data.status)}</strong>.</p>
        <p style="margin:0 0 12px;">${escapeHtml(parsed.data.message).replace(/\n/g, "<br />")}</p>
      `,
      ctaText: "Consultar encomenda",
      ctaHref: redirectTo,
      secondaryText: "Se precisar de ajuda com esta encomenda, contacte contacto@agrilink.ao.",
    });

    const result = await sendResendEmail({
      to: email,
      subject: `Atualização da encomenda ${parsed.data.order_id} — AgriLink`,
      html,
    });

    return jsonResponse({
      success: true,
      message: "Atualização de encomenda enviada com sucesso.",
      email,
      resend_id: result?.id ?? null,
    }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno ao enviar atualização de encomenda.";
    console.error("send-order-update-email failed:", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
