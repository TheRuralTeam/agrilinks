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
  full_name: z.string().trim().min(1).max(120).optional(),
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
      return jsonResponse({ error: "Dados inválidos para confirmação de conta." }, 400);
    }

    const email = normalizeEmail(parsed.data.email);
    const fullName = parsed.data.full_name?.trim() || "Agricultor";
    const redirectTo = safeRedirect(parsed.data.redirect_to, "https://agrilink.ao/auth/callback?next=%2Fapp");
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "signup",
      email,
      options: { redirectTo },
    });
    if (linkError) throw linkError;
    const hashedToken = linkData.properties?.hashed_token;
    if (!hashedToken) throw new Error("O Supabase não retornou o token de confirmação.");
    const actionUrl = new URL(redirectTo);
    actionUrl.searchParams.set("token_hash", hashedToken);
    actionUrl.searchParams.set("type", "signup");

    const html = buildBrandEmailTemplate({
      title: "Confirme a sua conta — AgriLink",
      preheader: "Confirme o seu email para ativar a sua conta na AgriLink.",
      headline: "Confirme a sua conta",
      bodyHtml: `
        <p style="margin:0 0 12px;">Olá ${fullName},</p>
        <p style="margin:0 0 12px;">Obrigado por se juntar à AgriLink.</p>
        <p style="margin:0 0 12px;">Para ativar a sua conta e começar a aproveitar a plataforma, confirme o seu endereço de e-mail.</p>
      `,
      ctaText: "Confirmar a minha conta",
      ctaHref: actionUrl.toString(),
      secondaryText: "Se você não criou esta conta, pode ignorar este e-mail.",
    });

    const result = await sendResendEmail({
      to: email,
      subject: "Confirme a sua conta — AgriLink",
      html,
    });

    return jsonResponse({
      success: true,
      message: "Confirmação enviada com sucesso.",
      email,
      resend_id: result?.id ?? null,
    }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno ao enviar confirmação.";
    console.error("send-confirmation-email failed:", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
