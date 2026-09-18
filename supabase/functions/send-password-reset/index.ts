import { z } from "npm:zod@3.23.8";
import { jsonResponse } from "../_shared/http.ts";
import { normalizeEmail, safeRedirect } from "../_shared/email.ts";

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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const [queued, queueOk] = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/email_outbox`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation,resolution=ignore-duplicates",
      },
      body: JSON.stringify({
        dedupe_key: `auth:recovery:${email}:${Math.floor(Date.now() / 60000)}`,
        recipient: email,
        subject: "Recuperar a password — AgriLink",
        template: "auth-recovery",
        priority: 100,
        payload: { redirect_to: redirectTo, email },
      }),
    }).then(async (response) => [await response.json().catch(() => null), response.ok] as const);
    if (!queueOk) throw new Error(queued?.message || "Não foi possível agendar a recuperação.");

    return jsonResponse({
      success: true,
      queued: true,
      message: "Recuperação agendada para envio.",
      email,
    }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno ao enviar recuperação.";
    console.error("send-password-reset failed:", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
