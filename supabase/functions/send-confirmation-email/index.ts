import { z } from "npm:zod@3.23.8";
import { jsonResponse } from "../_shared/http.ts";
import { normalizeEmail, safeRedirect } from "../_shared/email.ts";

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
    const [queued, queueOk] = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/rest/v1/email_outbox`,
      {
        method: "POST",
        headers: {
          apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
          "Content-Type": "application/json",
          Prefer: "return=representation,resolution=ignore-duplicates",
        },
        body: JSON.stringify({
          dedupe_key: `auth:signup:${email}:${Math.floor(Date.now() / 60000)}`,
          recipient: email,
          subject: "Confirme a sua conta — AgriLink",
          template: "auth-signup",
          priority: 100,
          payload: { full_name: fullName, redirect_to: redirectTo, email },
        }),
      },
    ).then(async (response) => [await response.json().catch(() => null), response.ok] as const);
    if (!queueOk) throw new Error(queued?.message || "Não foi possível agendar a confirmação.");

    return jsonResponse({
      success: true,
      queued: true,
      message: "Confirmação agendada para envio.",
      email,
    }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro interno ao enviar confirmação.";
    console.error("send-confirmation-email failed:", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
