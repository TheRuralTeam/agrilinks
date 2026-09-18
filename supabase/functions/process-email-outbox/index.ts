import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/http.ts";
import { buildBrandEmailTemplate, escapeHtml, sendResendEmail } from "../_shared/email.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function buildJobEmail(job: any) {
  const payload = job.payload ?? {};
  const fullName = escapeHtml(String(payload.full_name || "Utilizador AgriLink"));
  const template = String(job.template || "notification");

  if (["auth-signup", "auth-recovery", "auth-magic-link"].includes(template)) {
    const authType = template === "auth-signup"
      ? "signup"
      : template === "auth-recovery"
        ? "recovery"
        : String(payload.auth_type || "magiclink");
    const { data, error } = await supabase.auth.admin.generateLink({
      type: authType as "signup" | "recovery" | "magiclink",
      email: String(payload.email || job.recipient),
      options: { redirectTo: String(payload.redirect_to) },
    });
    if (error) throw error;
    const tokenHash = data.properties?.hashed_token;
    if (!tokenHash) throw new Error("O Supabase não retornou o token de autenticação.");
    const actionUrl = new URL(String(payload.redirect_to));
    actionUrl.searchParams.set("token_hash", tokenHash);
    actionUrl.searchParams.set("type", authType);
    const headline = template === "auth-recovery"
      ? "Recuperar a palavra-passe"
      : template === "auth-signup"
        ? "Confirme a sua conta"
        : "Confirme o seu email";
    return buildBrandEmailTemplate({
      title: job.subject,
      preheader: job.subject,
      headline,
      bodyHtml: `<p style="margin:0 0 12px;">Olá ${fullName},</p><p style="margin:0 0 12px;">Clique no botão abaixo para continuar na AgriLink.</p>`,
      ctaText: template === "auth-recovery" ? "Redefinir password" : "Confirmar o meu email",
      ctaHref: actionUrl.toString(),
    });
  }

  const title = escapeHtml(String(payload.title || job.subject));
  const message = escapeHtml(String(payload.message || "Tem uma nova notificação na AgriLink."));
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

  const { data: jobs, error } = await supabase.rpc("claim_email_outbox", { p_limit: 10 });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const results = await Promise.all((jobs ?? []).map(async (job) => {
    try {
      const html = await buildJobEmail(job);
      const result = await sendResendEmail({ to: job.recipient, subject: job.subject, html });
      await supabase.rpc("complete_email_outbox", { p_id: job.id, p_provider_id: result?.id ?? null });
      return true;
    } catch (sendError) {
      await supabase.rpc("fail_email_outbox", {
        p_id: job.id,
        p_error: sendError instanceof Error ? sendError.message : String(sendError),
        p_retry: true,
      });
      return false;
    }
  }));
  const sent = results.filter(Boolean).length;

  return new Response(JSON.stringify({ success: true, claimed: jobs?.length ?? 0, sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});