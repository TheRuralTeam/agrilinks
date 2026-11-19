import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/http.ts";
import { buildBrandEmailTemplate, escapeHtml, sendResendEmail } from "../_shared/email.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

type EmailOutboxJob = {
  id: string;
  recipient: string;
  subject: string;
  template: string;
  dedupe_key: string;
  payload: Record<string, unknown> | null;
};

async function buildJobEmail(job: EmailOutboxJob) {
  const payload = job.payload ?? {};
  const fullName = escapeHtml(String(payload.full_name || "Utilizador AgriLink"));
  const template = String(job.template || "notification");

  if (["auth-signup", "auth-recovery", "auth-magic-link"].includes(template)) {
    const authType: "signup" | "recovery" | "magiclink" = template === "auth-signup"
      ? payload.auth_type === "magiclink" ? "magiclink" : "signup"
      : template === "auth-recovery"
        ? "recovery"
        : payload.auth_type === "recovery"
          ? "recovery"
          : "magiclink";
    const email = String(payload.email || job.recipient);
    let effectiveType: "signup" | "recovery" | "magiclink" = authType;
    let tokenHash = typeof payload.token_hash === "string" ? payload.token_hash : "";
    const generateAuthLink = (type: "signup" | "recovery" | "magiclink") => {
      if (type === "signup") {
        return supabase.auth.admin.generateLink({
          type: "signup",
          email,
          password: String(payload.password || ""),
          options: { redirectTo: String(payload.redirect_to) },
        });
      }
      if (type === "recovery") {
        return supabase.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo: String(payload.redirect_to) },
        });
      }
      return supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: String(payload.redirect_to) },
      });
    };
    if (!tokenHash) {
      let linkResult = await generateAuthLink(effectiveType);
      if (linkResult.error && authType === "signup" && /already been registered|already registered|user already exists/i.test(linkResult.error.message)) {
        effectiveType = "magiclink";
        linkResult = await generateAuthLink("magiclink");
      }
      if (linkResult.error) throw linkResult.error;
      tokenHash = linkResult.data.properties?.hashed_token || "";
    }
    if (!tokenHash) throw new Error("O Supabase não retornou o token de autenticação.");
    const actionUrl = new URL(String(payload.redirect_to));
    actionUrl.searchParams.set("token_hash", tokenHash);
    actionUrl.searchParams.set("type", effectiveType);
    const headline = template === "auth-recovery"
      ? "Recuperar a palavra-passe"
      : effectiveType === "magiclink" && template === "auth-signup"
        ? "Aceda à sua conta AgriLink"
      : template === "auth-signup"
        ? "Confirme a sua conta"
        : "Confirme o seu email";
    const authBody = template === "auth-recovery"
      ? `<p style="margin:0 0 12px;">Olá ${fullName},</p><p style="margin:0 0 12px;">Recebemos um pedido para redefinir a palavra-passe da sua conta AgriLink. Utilize o botão abaixo para continuar.</p><p style="margin:0;">Se não pediu esta alteração, ignore esta mensagem.</p>`
      : template === "auth-signup" && effectiveType === "signup"
        ? `<p style="margin:0 0 12px;">Olá ${fullName},</p><p style="margin:0;">Para activar a sua conta AgriLink, confirme o seu endereço de email através do botão abaixo.</p>`
        : `<p style="margin:0 0 12px;">Olá ${fullName},</p><p style="margin:0 0 12px;">Utilize o botão abaixo para entrar na sua conta AgriLink.</p><p style="margin:0;">Se não pediu este acesso, ignore esta mensagem.</p>`;
    const authPreheader = template === "auth-recovery"
      ? "Pedido de recuperação da palavra-passe da sua conta AgriLink."
      : template === "auth-signup" && effectiveType === "signup"
        ? "Confirme o seu endereço de email para activar a conta AgriLink."
        : "Aceda à sua conta AgriLink através de um link seguro.";

    return buildBrandEmailTemplate({
      title: job.subject,
      preheader: authPreheader,
      headline,
      bodyHtml: authBody,
      ctaText: template === "auth-recovery"
        ? "Redefinir palavra-passe"
        : effectiveType === "magiclink"
          ? "Entrar na AgriLink"
          : "Confirmar endereço de email",
      ctaHref: actionUrl.toString(),
    });
  }

  if (template === "auth-otp") {
    const expiresAt = Date.parse(String(payload.expires_at || ""));
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      throw new Error("OTP_EXPIRED: o código expirou antes da entrega.");
    }
    const code = String(payload.otp_code || "");
    if (!/^\d{6}$/.test(code)) throw new Error("OTP_INVALID: código ausente ou inválido.");

    const { data: activeCode, error: codeLookupError } = await supabase
      .from("email_verification_codes")
      .select("id")
      .eq("email", String(job.recipient).trim().toLowerCase())
      .eq("code", code)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (codeLookupError) throw new Error("Não foi possível validar o estado do código OTP.");
    if (!activeCode) throw new Error("OTP_SUPERSEDED: o código já não é o código activo.");

    return buildBrandEmailTemplate({
      title: job.subject,
      preheader: "O código para confirmar o seu email na AgriLink.",
      headline: "Confirme o seu email",
      bodyHtml: [
        `<p style="margin:0 0 16px;">Olá ${fullName},</p>`,
        '<p style="margin:0 0 22px;">Introduza o código abaixo para confirmar o seu endereço de email.</p>',
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;"><tr><td align="center" style="padding:20px 12px;background:#f1f7f0;border:1px solid #dce9dc;border-radius:6px;color:#176b3a;font-family:Arial,Helvetica,sans-serif;font-size:32px;line-height:40px;font-weight:700;letter-spacing:8px;">${code}</td></tr></table>`,
        '<p style="margin:0 0 12px;font-size:13px;line-height:21px;color:#526158;">O código é válido durante 15 minutos.</p>',
        '<p style="margin:0;font-size:13px;line-height:21px;color:#526158;">Se não pediu este código, ignore este email.</p>',
      ].join(""),
    });
  }

  if (template === "support-contact") {
    const name = escapeHtml(String(payload.name || "Utilizador"));
    const email = escapeHtml(String(payload.email || ""));
    const phone = escapeHtml(String(payload.phone || "Não indicado"));
    const message = escapeHtml(String(payload.message || "")).replace(/\n/g, "<br />");
    return buildBrandEmailTemplate({
      title: job.subject,
      preheader: "Nova mensagem recebida através do portal de suporte da AgriLink.",
      headline: "Nova mensagem de suporte",
      bodyHtml: `
        <p style="margin:0 0 12px;"><strong>Nome:</strong> ${name}</p>
        <p style="margin:0 0 12px;"><strong>Email:</strong> ${email}</p>
        <p style="margin:0 0 12px;"><strong>Telefone:</strong> ${phone}</p>
        <p style="margin:0 0 12px;"><strong>Mensagem:</strong></p>
        <p style="margin:0 0 12px;">${message}</p>
      `,
      secondaryText: "Mensagem recebida através do formulário de contacto da AgriLink.",
    });
  }

  if (template === "order-update") {
    const orderId = escapeHtml(String(payload.order_id || ""));
    const status = escapeHtml(String(payload.status || ""));
    const message = escapeHtml(String(payload.message || "")).replace(/\n/g, "<br />");
    const redirectTo = String(payload.redirect_to || "https://agrilink.ao/app");
    const safeUrl = new URL(redirectTo);
    if (!["agrilink.ao", "www.agrilink.ao"].includes(safeUrl.hostname.toLowerCase())) {
      throw new Error("Redirect de encomenda não permitido.");
    }
    return buildBrandEmailTemplate({
      title: job.subject,
      preheader: `A sua encomenda ${orderId} teve uma atualização de estado.`,
      headline: `Encomenda ${orderId}`,
      bodyHtml: `
        <p style="margin:0 0 12px;">Olá ${fullName},</p>
        <p style="margin:0 0 12px;">O estado da sua encomenda foi atualizado para: <strong>${status}</strong>.</p>
        <p style="margin:0 0 12px;">${message}</p>
      `,
      ctaText: "Consultar encomenda",
      ctaHref: safeUrl.toString(),
      secondaryText: "Se precisar de ajuda com esta encomenda, contacte contacto@agrilink.ao.",
    });
  }

  if (template === "pre-order-accepted") {
    const product = escapeHtml(String(payload.product_name || "produto agrícola"));
    const quantity = Number(payload.quantity || 0);
    const unitPrice = Number(payload.unit_price || 0);
    const total = Number(payload.total_price || quantity * unitPrice);
    const pickup = escapeHtml(String(payload.pickup_location || "A definir"));
    const receiving = escapeHtml(String(payload.receiving_point || "A definir"));
    const supplier = escapeHtml(String(payload.supplier_name || "Fornecedor AgriLink"));
    const money = (value: number) => value.toLocaleString("pt-AO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return buildBrandEmailTemplate({
      title: job.subject,
      preheader: "O fornecedor confirmou a disponibilidade da sua pré-compra.",
      headline: "Pré-compra aceite",
      bodyHtml: `
        <p style="margin:0 0 14px;">Olá ${fullName},</p>
        <p style="margin:0 0 18px;">O fornecedor confirmou a disponibilidade da quantidade solicitada.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:0;width:100%;border:1px solid #dfe7e1;border-radius:14px;overflow:hidden;">
          <tr><td style="padding:12px 14px;background:#f4faf5;font-size:12px;color:#5b6b5e;font-weight:700;">PRODUTO</td><td style="padding:12px 14px;background:#f4faf5;font-size:14px;color:#111714;text-align:right;font-weight:800;">${product}</td></tr>
          <tr><td style="padding:12px 14px;font-size:12px;color:#758a79;">Quantidade disponível</td><td style="padding:12px 14px;font-size:14px;color:#111714;text-align:right;font-weight:700;">${quantity.toLocaleString("pt-AO")} kg</td></tr>
          <tr><td style="padding:12px 14px;font-size:12px;color:#758a79;">Preço unitário</td><td style="padding:12px 14px;font-size:14px;color:#111714;text-align:right;font-weight:700;">${money(unitPrice)} Kz/kg</td></tr>
          <tr><td style="padding:12px 14px;font-size:12px;color:#758a79;">Local de recolha</td><td style="padding:12px 14px;font-size:14px;color:#111714;text-align:right;font-weight:700;">${pickup}</td></tr>
          <tr><td style="padding:12px 14px;font-size:12px;color:#758a79;">Ponto de recebimento</td><td style="padding:12px 14px;font-size:14px;color:#111714;text-align:right;font-weight:700;">${receiving}</td></tr>
          <tr><td style="padding:14px;background:#14532d;color:#ffffff;font-size:13px;font-weight:800;">TOTAL</td><td style="padding:14px;background:#14532d;color:#ffffff;font-size:18px;text-align:right;font-weight:900;">${money(total)} Kz</td></tr>
        </table>
      `,
      ctaText: "Abrir a minha pré-compra",
      ctaHref: "https://www.agrilink.ao/app",
      secondaryText: `Fornecedor: ${supplier}. Consulte a AgriLink para acompanhar o pagamento e a entrega.`,
    });
  }

  const title = escapeHtml(String(payload.title || job.subject));
  const message = escapeHtml(String(payload.message || "Consulte a sua conta AgriLink para ver a atualização."));
  return buildBrandEmailTemplate({
    title: job.subject,
    preheader: job.subject,
    headline: title,
    bodyHtml: `<p style="margin:0 0 12px;">Olá ${fullName},</p><p style="margin:0;">${message}</p>`,
    ctaText: "Abrir AgriLink",
    ctaHref: "https://www.agrilink.ao/app",
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Método não permitido." }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const workerSecret = req.headers.get("x-worker-secret");
  if (!workerSecret) {
    return new Response(JSON.stringify({ error: "Acesso interno obrigatório." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: workerAuthorized, error: workerAuthError } = await supabase.rpc(
    "is_valid_email_outbox_worker_secret",
    { p_candidate: workerSecret },
  );
  if (workerAuthError || workerAuthorized !== true) {
    console.warn("Tentativa não autorizada de executar a fila de emails.");
    return new Response(JSON.stringify({ error: "Acesso interno obrigatório." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: jobs, error } = await supabase.rpc("claim_email_outbox", { p_limit: 10 });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const results = await Promise.all((jobs ?? []).map(async (job: EmailOutboxJob) => {
    try {
      const html = await buildJobEmail(job);
      const result = await sendResendEmail({
        to: job.recipient,
        subject: job.subject,
        html,
        idempotencyKey: String(job.dedupe_key),
        ...(typeof job.payload?.reply_to === "string" ? { replyTo: job.payload.reply_to } : {}),
      });
      const providerId = typeof result?.id === "string" ? result.id : "";
      if (!providerId) throw new Error("O Resend não devolveu um identificador de envio.");
      const { error: completeError } = await supabase.rpc("complete_email_outbox", {
        p_id: job.id,
        p_provider_id: providerId,
      });
      if (completeError) throw completeError;
      return true;
    } catch (sendError) {
      await supabase.rpc("fail_email_outbox", {
        p_id: job.id,
        p_error: sendError instanceof Error ? sendError.message : String(sendError),
        p_retry: !/^(OTP_EXPIRED|OTP_INVALID|OTP_SUPERSEDED):/.test(sendError instanceof Error ? sendError.message : String(sendError)),
      });
      return false;
    }
  }));
  const sent = results.filter(Boolean).length;

  return new Response(JSON.stringify({ success: true, claimed: jobs?.length ?? 0, sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});