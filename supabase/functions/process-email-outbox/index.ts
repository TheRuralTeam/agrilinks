import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/http.ts";
import { buildBrandEmailTemplate, sendResendEmail } from "../_shared/email.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Método não permitido." }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { data: jobs, error } = await supabase.rpc("claim_email_outbox", { p_limit: 25 });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  let sent = 0;
  for (const job of jobs ?? []) {
    try {
      const payload = job.payload ?? {};
      const fullName = String(payload.full_name || "Utilizador AgriLink");
      const html = buildBrandEmailTemplate({
        title: job.subject,
        preheader: job.subject,
        headline: String(payload.title || job.subject),
        bodyHtml: `<p style="margin:0 0 12px;">Olá ${fullName},</p><p style="margin:0;">${String(payload.message || "Tem uma nova notificação na AgriLink.")}</p>`,
        ctaText: "Abrir AgriLink",
        ctaHref: "https://www.agrilink.ao/app",
      });
      const result = await sendResendEmail({ to: job.recipient, subject: job.subject, html });
      await supabase.rpc("complete_email_outbox", { p_id: job.id, p_provider_id: result?.id ?? null });
      sent += 1;
    } catch (sendError) {
      await supabase.rpc("fail_email_outbox", {
        p_id: job.id,
        p_error: sendError instanceof Error ? sendError.message : String(sendError),
        p_retry: true,
      });
    }
  }

  return new Response(JSON.stringify({ success: true, claimed: jobs?.length ?? 0, sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});