import { z } from "npm:zod@3.23.8";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { jsonResponse } from "../_shared/http.ts";
import {
  buildBrandEmailTemplate,
  normalizeEmail,
  safeRedirect,
  sendResendEmail,
} from "../_shared/email.ts";

const BodySchema = z.object({
  email: z.string().trim().email().max(255),
  redirect_to: z.string().trim().url().max(500).optional(),
});

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
      return jsonResponse({ error: "Dados inválidos para recuperação de password." }, 400);
    }

    const email = normalizeEmail(parsed.data.email);
    const redirectTo = safeRedirect(parsed.data.redirect_to, "https://agrilink.ao/auth/callback?next=%2Freset-password");
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (linkError) throw linkError;
    const hashedToken = linkData.properties?.hashed_token;
    if (!hashedToken) throw new Error("O Supabase não retornou o token de recuperação.");
    const actionUrl = new URL(redirectTo);
    actionUrl.searchParams.set("token_hash", hashedToken);
    actionUrl.searchParams.set("type", "recovery");

    const html = buildBrandEmailTemplate({
      title: "Recuperar a password — AgriLink",
      preheader: "Use este link para redefinir a sua palavra-passe da AgriLink.",
      headline: "Recuperar a palavra-passe",
      bodyHtml: `
        <p style="margin:0 0 12px;">Olá,</p>
        <p style="margin:0 0 12px;">Recebemos um pedido para redefinir a sua palavra-passe na AgriLink.</p>
        <p style="margin:0 0 12px;">Clique no botão abaixo para criar uma nova senha.</p>
      `,
      ctaText: "Redefinir password",
      ctaHref: actionUrl.toString(),
      secondaryText: "Se não pediu esta alteração, pode ignorar este e-mail com segurança.",
    });

    const result = await sendResendEmail({
      to: email,
      subject: "Recuperar a password — AgriLink",
      html,
    });

    return jsonResponse({
      success: true,
      message: "Link de recuperação enviado com sucesso.",
      email,
      resend_id: result?.id ?? null,
    }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno ao enviar recuperação.";
    console.error("send-password-reset failed:", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
