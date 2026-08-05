import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2.57.4/cors";
import { Resend } from "npm:resend@2.0.0";
import { sendEmailWithRetry } from "../_shared/resend.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const BodySchema = z.object({
  email: z.string().trim().email().max(255),
  full_name: z.string().trim().min(1).max(120).optional(),
  redirect_to: z.string().trim().url().max(500).optional(),
});

const ALLOWED_HOSTS = [
  "agrilink.ao",
  "www.agrilink.ao",
  "agrilinks.lovable.app",
  "localhost",
];

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const safeRedirect = (candidate?: string) => {
  const fallback = "https://agrilink.ao/auth/callback?next=/app";
  if (!candidate) return fallback;
  try {
    const url = new URL(candidate);
    const host = url.hostname;
    const ok = ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
    return ok ? url.toString() : fallback;
  } catch {
    return fallback;
  }
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Email inválido." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const email = parsed.data.email.toLowerCase();
    const redirectTo = safeRedirect(parsed.data.redirect_to);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let fullName = parsed.data.full_name || "Utilizador AgriLink";
    const { data: userRow } = await supabase
      .from("users")
      .select("id, full_name")
      .eq("email", email)
      .maybeSingle();
    if (userRow?.full_name) fullName = userRow.full_name;

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("generateLink error:", linkError);
      return new Response(
        JSON.stringify({ error: "Não foi possível gerar o link de confirmação para este email." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Build our OWN confirmation URL using the hashed token.
    // The email never exposes the Supabase /verify endpoint directly, so
    // Gmail/Outlook link scanners cannot consume the one-time token before
    // the user actually clicks. The token is only exchanged on a real click.
    const hashedToken = (linkData.properties as any)?.hashed_token as string | undefined;
    let actionLink = linkData.properties.action_link;
    try {
      const base = new URL(redirectTo);
      if (hashedToken) {
        const nextPath = base.searchParams.get("next") || "/app";
        actionLink = `${base.origin}/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=magiclink&next=${encodeURIComponent(nextPath)}`;
      }
    } catch (_) {
      // keep the default action link
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("Serviço de email indisponível.");

    const resend = new Resend(resendApiKey);
    const safeFullName = escapeHtml(fullName);
    const PRIMARY_FROM = Deno.env.get("RESEND_FROM") || "AgriLink <no-reply@agrilink.ao>";
    const FALLBACK_FROM = "AgriLink <onboarding@resend.dev>";

    const buildPayload = (from: string) => ({
      from,
      reply_to: "contacto@agrilink.ao",
      to: [email],
      subject: "Confirme o seu email AgriLink",
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; max-width: 620px; margin: 0 auto; padding: 28px 18px; background: #ffffff; color: #111714;">
          <div style="border: 1px solid #DDE8DF; border-radius: 18px; overflow: hidden;">
            <div style="padding: 28px 30px 22px; background: #F6FAEC; border-bottom: 4px solid #7CB342;">
              <h1 style="color: #7CB342; margin: 0; font-size: 30px;">AgriLink</h1>
              <p style="color: #3A4D40; margin: 10px 0 0; font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700;">Confirmação de conta</p>
            </div>
            <div style="padding: 32px 30px;">
              <h2 style="margin: 0 0 10px; font-size: 21px;">Olá, ${safeFullName}</h2>
              <p style="color: #3D4D40; margin: 0 0 26px; font-size: 15px; line-height: 1.7;">
                Clique no botão abaixo para confirmar o seu email e libertar todas as ações da sua conta AgriLink.
              </p>
              <div style="text-align:center; margin: 8px 0 22px;">
                <a href="${actionLink}" style="display:inline-block; background:#7CB342; color:#ffffff; text-decoration:none; font-weight:800; font-size:16px; padding:16px 30px; border-radius:12px;">
                  Confirmar o meu email
                </a>
              </div>
              <p style="color: #6B8070; margin: 0; font-size: 13px; line-height: 1.6;">
                Este link expira em <strong style="color:#B07D0A;">1 hora</strong> e só pode ser usado uma vez.
                Se não solicitou este acesso, ignore este email.
              </p>
              <p style="color:#9DB5A4; font-size:12px; word-break:break-all; margin-top:18px;">
                Se o botão não funcionar, copie este endereço: ${actionLink}
              </p>
            </div>
            <div style="padding: 18px 30px; background: #FAFCFA; border-top: 1px solid #DDE8DF;">
              <p style="color: #9DB5A4; font-size: 12px; text-align: center; margin: 0;">
                Enviado por no-reply@agrilink.ao · © ${new Date().getFullYear()} AgriLink
              </p>
            </div>
          </div>
        </div>
      `,
    });

    let usedFrom = PRIMARY_FROM;
    const first = await sendEmailWithRetry(resend, buildPayload(PRIMARY_FROM));
    let emailError = first?.error;

    // Domínio ainda não verificado no Resend → não bloquear o fluxo de confirmação
    if (emailError && /not verified|domain/i.test(emailError.message || "")) {
      console.warn("Domínio primário indisponível no Resend, a usar fallback:", emailError.message);
      usedFrom = FALLBACK_FROM;
      const retry = await sendEmailWithRetry(resend, buildPayload(FALLBACK_FROM));
      emailError = retry?.error;
    }

    if (emailError) {
      console.error("Resend error:", emailError);
      throw new Error("Erro ao enviar email: " + (emailError.message || String(emailError)));
    }


    return new Response(
      JSON.stringify({ success: true, from: usedFrom, expires_in_minutes: 60, message: "Link de confirmação enviado para " + email }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("send-magic-link error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
