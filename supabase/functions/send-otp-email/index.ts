import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2.57.4/cors";
import { Resend } from "npm:resend@2.0.0";
import { sendEmailWithRetry } from "../_shared/resend.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

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
    // ============================================
    // 1. VALIDAR BODY
    // ============================================

    let body: unknown;
    try {
      body = await req.json();
    } catch (err) {
      console.error("send-otp-email: JSON inválido no request body:", err);
      return new Response(
        JSON.stringify({
          error: "JSON inválido no request body.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    console.log("send-otp-email request body:", body);

    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      console.error("Dados inválidos:", parsed.error);

      return new Response(
        JSON.stringify({
          error: "Dados inválidos para envio do código.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    const email = parsed.data.email.toLowerCase().trim();

    // ============================================
    // 2. CONFIGURAÇÕES
    // ============================================

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL não configurada.");
    }

    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
    }

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY não configurada.");
    }

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    // ============================================
    // 3. ENCONTRAR UTILIZADOR
    // ============================================

    let userId = parsed.data.user_id;
    let fullName =
      parsed.data.full_name?.trim() || "Utilizador AgriLink";

    if (!userId) {
      console.log(
        "user_id não fornecido. Procurando utilizador pelo email:",
        email,
      );

      const { data: userRow, error: userError } = await supabase
        .from("users")
        .select("id, full_name, email")
        .ilike("email", email)
        .maybeSingle();

      if (userError) {
        console.error(
          "Erro ao procurar utilizador:",
          userError,
        );

        return new Response(
          JSON.stringify({
            error: "Erro ao procurar a conta.",
            details: userError.message,
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

      if (!userRow?.id) {
        console.error(
          "Nenhuma conta encontrada para:",
          email,
        );

        return new Response(
          JSON.stringify({
            error: "Conta não encontrada para este email.",
          }),
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

      console.log(
        "Utilizador encontrado:",
        userId,
      );
    }

    // ============================================
    // 4. GERAR CÓDIGO OTP
    // ============================================

    const otpCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    console.log(
      "OTP gerado para:",
      email,
    );

    // ============================================
    // 5. PROTEGER NOME CONTRA HTML
    // ============================================

    const safeFullName = escapeHtml(fullName);

    // ============================================
    // 6. ENVIAR EMAIL
    // ============================================

    const resend = new Resend(resendApiKey);

    const sendResult = await sendEmailWithRetry(
      resend,
      {
        from: "AgriLink <no-reply@agrilink.ao>",
        reply_to: "contacto@agrilink.ao",
        to: [email],
        subject: `${otpCode} é o seu código AgriLink`,

        html: `
          <div
            style="
              font-family: Arial, Helvetica, sans-serif;
              max-width: 620px;
              margin: 0 auto;
              padding: 28px 18px;
              background: #ffffff;
              color: #111714;
            "
          >

            <div
              style="
                border: 1px solid #DDE8DF;
                border-radius: 18px;
                overflow: hidden;
                background: #ffffff;
              "
            >

              <div
                style="
                  padding: 28px 30px 22px;
                  background: #F6FAEC;
                  border-bottom: 4px solid #7CB342;
                "
              >
                <h1
                  style="
                    color: #7CB342;
                    margin: 0;
                    font-size: 30px;
                    line-height: 1;
                    letter-spacing: -0.3px;
                  "
                >
                  AgriLink
                </h1>

                <p
                  style="
                    color: #3A4D40;
                    margin: 10px 0 0;
                    font-size: 13px;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    font-weight: 700;
                  "
                >
                  Confirmação de conta
                </p>
              </div>

              <div style="padding: 32px 30px;">

                <h2
                  style="
                    color: #111714;
                    margin: 0 0 10px;
                    font-size: 21px;
                    line-height: 1.3;
                  "
                >
                  Olá, ${safeFullName}
                </h2>

                <p
                  style="
                    color: #3D4D40;
                    margin: 0 0 26px;
                    font-size: 15px;
                    line-height: 1.7;
                  "
                >
                  Use este código de 6 dígitos para confirmar
                  o seu email e ativar as ações da sua conta AgriLink.
                </p>

                <div
                  style="
                    background: #7CB342;
                    color: #ffffff;
                    font-size: 38px;
                    font-weight: 800;
                    letter-spacing: 12px;
                    padding: 22px 24px;
                    border-radius: 12px;
                    text-align: center;
                    font-family: 'Courier New', monospace;
                  "
                >
                  ${otpCode}
                </div>

                <p
                  style="
                    color: #6B8070;
                    margin: 24px 0 0;
                    font-size: 13px;
                    line-height: 1.6;
                  "
                >
                  Este código expira em
                  <strong style="color:#B07D0A;">
                    15 minutos
                  </strong>.
                  Se não solicitaste este cadastro,
                  podes ignorar este email.
                </p>

              </div>

              <div
                style="
                  padding: 18px 30px;
                  background: #FAFCFA;
                  border-top: 1px solid #DDE8DF;
                "
              >
                <p
                  style="
                    color: #9DB5A4;
                    font-size: 12px;
                    text-align: center;
                    margin: 0;
                    line-height: 1.5;
                  "
                >
                  Enviado por no-reply@agrilink.ao ·
                  Responder para contacto@agrilink.ao ·
                  © ${new Date().getFullYear()} AgriLink
                </p>
              </div>

            </div>

          </div>
        `,
      },
    );

    // ============================================
    // 7. VERIFICAR RESULTADO
    // ============================================

    const emailError = sendResult?.error;
    const emailData = sendResult?.data ?? sendResult;

    if (emailError) {
      console.error(
        "Erro ao enviar email:",
        emailError,
      );

      throw new Error(
        "Erro ao enviar email: " +
          (emailError.message || String(emailError)),
      );
    }

    console.log(
      "Email enviado com sucesso para:",
      email,
      "Email ID:",
      emailData?.id,
    );

    // ============================================
    // 8. RESPOSTA
    // ============================================

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
    console.error(
      "Erro na função send-otp-email:",
      error,
    );

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Erro interno do servidor.",
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