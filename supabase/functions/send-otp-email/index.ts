import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { buildBrandEmailTemplate, escapeHtml } from "../_shared/email.ts";
import {
  buildResendSenderOptions,
  normalizeEmailForDelivery,
  sendWithFallback,
} from "../_shared/resend.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  user_id: z.string().uuid().optional(),
  email: z.string().trim().email().max(255),
  full_name: z.string().trim().min(1).max(120).optional(),
});

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    let body: unknown;

    try {
      body = await req.json();
    } catch (err) {
      console.error("send-otp-email: JSON inválido no request body:", err);
      return new Response(
        JSON.stringify({ error: "JSON inválido no request body." }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      console.error("Dados inválidos:", parsed.error);
      return new Response(
        JSON.stringify({ error: "Dados inválidos para envio do código." }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    const email = normalizeEmailForDelivery(parsed.data.email);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl) throw new Error("SUPABASE_URL não configurada.");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
    if (!resendApiKey) throw new Error("RESEND_API_KEY não configurada.");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let userId = parsed.data.user_id;
    let fullName = parsed.data.full_name?.trim() || "Utilizador AgriLink";

    if (!userId) {
      console.log("user_id não fornecido. Procurando utilizador pelo email:", email);

      const { data: userRow, error: userError } = await supabase
        .from("users")
        .select("id, full_name, email")
        .ilike("email", email)
        .maybeSingle();

      if (userError) {
        console.error("Erro ao procurar utilizador:", userError);
        return new Response(
          JSON.stringify({ error: "Erro ao procurar a conta.", details: userError.message }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          },
        );
      }

      if (!userRow?.id) {
        console.error("Nenhuma conta encontrada para:", email);
        return new Response(
          JSON.stringify({ error: "Conta não encontrada para este email." }),
          {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          },
        );
      }

      userId = userRow.id;
      fullName = userRow.full_name || fullName;
      console.log("Utilizador encontrado:", userId);
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 15).toISOString();

    const { error: invalidatePrevCodesError } = await supabase
      .from("email_verification_codes")
      .update({ verified: true })
      .eq("email", email)
      .eq("verified", false);

    if (invalidatePrevCodesError) {
      console.error("Erro ao invalidar códigos anteriores:", invalidatePrevCodesError);
      return new Response(
        JSON.stringify({ error: "Não foi possível preparar a verificação do email." }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    const { error: insertOtpError } = await supabase
      .from("email_verification_codes")
      .insert({
        user_id: userId,
        email,
        code: otpCode,
        expires_at: expiresAt,
        verified: false,
      });

    if (insertOtpError) {
      console.error("Erro ao guardar o código OTP:", insertOtpError);
      return new Response(
        JSON.stringify({ error: "Não foi possível guardar o código de verificação." }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    console.log("OTP gerado e guardado para:", email, "expira em:", expiresAt);

    const safeFullName = escapeHtml(fullName);
    const senderOptions = buildResendSenderOptions(
      "AgriLink <no-reply@agrilink.ao>",
      "AgriLink <onboarding@resend.dev>",
    );

    const resendSender = async (payload: any) => {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let data: any = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { message: text || "Resend email delivery failed" };
      }

      if (!response.ok) {
        return {
          error: new Error(data?.message || `Resend request failed (${response.status})`),
          data: null,
        };
      }

      return { error: null, data };
    };

    const emailHtml = buildBrandEmailTemplate({
      title: "Código de verificação — AgriLink",
      preheader: "O seu código de verificação da AgriLink.",
      headline: "Confirme o seu email",
      bodyHtml: `
        <p style="margin:0 0 16px;">Olá ${safeFullName},</p>
        <p style="margin:0 0 22px;">Introduza o código abaixo para confirmar o seu endereço de email.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
          <tr><td align="center" style="padding:20px 12px;background:#f1f7f0;border:1px solid #dce9dc;border-radius:6px;color:#176b3a;font-family:Arial,Helvetica,sans-serif;font-size:32px;line-height:40px;font-weight:700;letter-spacing:8px;">${otpCode}</td></tr>
        </table>
        <p style="margin:0 0 12px;font-size:13px;line-height:21px;color:#526158;">O código é válido durante 15 minutos.</p>
        <p style="margin:0;font-size:13px;line-height:21px;color:#526158;">Se não pediste este código, ignora este email.</p>
      `,
    });

    const delivery = await sendWithFallback(
      resendSender,
      (from) => ({
        from,
        reply_to: "contacto@agrilink.ao",
        to: [email],
        subject: "O seu código de verificação — AgriLink",
        html: emailHtml,
      }),
      senderOptions.candidates,
      3,
      500,
    );

    if (!delivery.ok) {
      console.error("Erro ao enviar email:", delivery.error);
      throw new Error("Erro ao enviar email: " + (delivery.error?.message || String(delivery.error)));
    }

    console.log("Email enviado com sucesso para:", email, "Email ID:", delivery.data?.id, "via:", delivery.sender);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Código enviado para " + email,
        user_id: userId,
        full_name: fullName,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  } catch (error) {
    console.error("Erro na função send-otp-email:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro interno do servidor.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  }
});