import { z } from "npm:zod@3.23.8";
import {
  buildBrandEmailTemplate,
  jsonResponse,
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

    const email = normalizeEmail(parsed.data.email);
    const customerName = parsed.data.customer_name?.trim() || "Cliente";
    const redirectTo = safeRedirect(parsed.data.redirect_to, "https://agrilink.ao/app");

    const html = buildBrandEmailTemplate({
      title: `Atualização da encomenda ${parsed.data.order_id} — AgriLink`,
      preheader: `A sua encomenda ${parsed.data.order_id} teve uma atualização de estado.`,
      headline: `Encomenda ${parsed.data.order_id}`,
      bodyHtml: `
        <p style="margin:0 0 12px;">Olá ${customerName},</p>
        <p style="margin:0 0 12px;">O estado da sua encomenda foi atualizado para: <strong>${parsed.data.status}</strong>.</p>
        <p style="margin:0 0 12px;">${parsed.data.message}</p>
      `,
      ctaText: "Consultar encomenda",
      ctaHref: redirectTo,
      secondaryText: "Se tiver alguma dúvida, responda a este e-mail ou contacte a nossa equipa.",
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
