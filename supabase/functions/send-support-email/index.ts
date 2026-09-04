import { z } from "npm:zod@3.23.8";
import {
  buildBrandEmailTemplate,
  jsonResponse,
  normalizeEmail,
  sendResendEmail,
} from "../_shared/email.ts";

const BodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(50).optional(),
  message: z.string().trim().min(10).max(5000),
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
      return jsonResponse({ error: "Dados inválidos para contacto de suporte." }, 400);
    }

    const fromEmail = normalizeEmail(parsed.data.email);
    const phone = parsed.data.phone?.trim() || "Não informado";
    const message = parsed.data.message.trim();
    const name = parsed.data.name.trim();

    const html = buildBrandEmailTemplate({
      title: "Nova mensagem de suporte — AgriLink",
      preheader: "Recebeu uma nova mensagem do portal de suporte da AgriLink.",
      headline: "Nova mensagem de suporte",
      bodyHtml: `
        <p style="margin:0 0 12px;"><strong>Nome:</strong> ${name}</p>
        <p style="margin:0 0 12px;"><strong>Email:</strong> ${fromEmail}</p>
        <p style="margin:0 0 12px;"><strong>Telefone:</strong> ${phone}</p>
        <p style="margin:0 0 12px;"><strong>Mensagem:</strong></p>
        <p style="margin:0 0 12px;">${message.replace(/\n/g, "<br />")}</p>
      `,
      secondaryText: "Esta mensagem foi gerada automaticamente pelo formulário de suporte da plataforma.",
    });

    const result = await sendResendEmail({
      to: "contacto@agrilink.ao",
      subject: `Suporte AgriLink — ${name}`,
      html,
      replyTo: fromEmail,
    });

    return jsonResponse({
      success: true,
      message: "Mensagem enviada ao suporte com sucesso.",
      email: fromEmail,
      resend_id: result?.id ?? null,
    }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno ao enviar suporte.";
    console.error("send-support-email failed:", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
