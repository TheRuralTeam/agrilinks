import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { Resend } from "npm:resend@2.0.0";
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
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Dados inválidos para envio do código." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const email = parsed.data.email.toLowerCase();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let userId = parsed.data.user_id;
    let fullName = parsed.data.full_name || "Utilizador AgriLink";

    if (!userId) {
      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('email', email)
        .maybeSingle();

      if (userError || !userRow?.id) {
        return new Response(JSON.stringify({ error: "Conta não encontrada para este email." }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      userId = userRow.id;
      fullName = userRow.full_name || fullName;
    }

    // Generate OTP using database function
    const { data: otpCode, error: otpError } = await supabase.rpc('generate_email_otp', {
      p_user_id: userId,
      p_email: email
    });

    if (otpError) {
      console.error("Error generating OTP:", otpError);
      throw new Error("Erro ao gerar código OTP");
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("Serviço de email indisponível.");
    }

    const safeFullName = escapeHtml(fullName);

    // Send email using Resend
    const resend = new Resend(resendApiKey);

    const { data: emailData, error: emailError } = await resend.emails.send({
      // Domínio agrilink.ao verificado no Resend (DKIM resend._domainkey + send.agrilink.ao)
      from: "AgriLink <no-reply@agrilink.ao>",
      reply_to: "contacto@agrilink.ao",
      to: [email],
      subject: `${otpCode} é o seu código AgriLink`,
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; max-width: 620px; margin: 0 auto; padding: 28px 18px; background: #ffffff; color: #111714;">
          <div style="border: 1px solid #DDE8DF; border-radius: 18px; overflow: hidden; background: #ffffff;">
            <div style="padding: 28px 30px 22px; background: #F6FAEC; border-bottom: 4px solid #7CB342;">
              <h1 style="color: #7CB342; margin: 0; font-size: 30px; line-height: 1; letter-spacing: -0.3px;">AgriLink</h1>
              <p style="color: #3A4D40; margin: 10px 0 0; font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700;">Confirmação de conta</p>
            </div>

            <div style="padding: 32px 30px;">
              <h2 style="color: #111714; margin: 0 0 10px; font-size: 21px; line-height: 1.3;">Olá, ${safeFullName}</h2>
              <p style="color: #3D4D40; margin: 0 0 26px; font-size: 15px; line-height: 1.7;">
                Use este código de 6 dígitos para confirmar o seu email e ativar as ações da sua conta AgriLink.
              </p>

              <div style="background: #7CB342; color: #ffffff; font-size: 38px; font-weight: 800; letter-spacing: 12px; padding: 22px 24px; border-radius: 12px; text-align: center; font-family: 'Courier New', monospace;">
                ${otpCode}
              </div>

              <p style="color: #6B8070; margin: 24px 0 0; font-size: 13px; line-height: 1.6;">
                Este código expira em <strong style="color:#B07D0A;">15 minutos</strong>. Se não solicitaste este cadastro, podes ignorar este email.
              </p>
            </div>

            <div style="padding: 18px 30px; background: #FAFCFA; border-top: 1px solid #DDE8DF;">
              <p style="color: #9DB5A4; font-size: 12px; text-align: center; margin: 0; line-height: 1.5;">
                Enviado por no-reply@agrilink.ao · Responder para contacto@agrilink.ao · © ${new Date().getFullYear()} AgriLink
              </p>
            </div>
          </div>
        </div>
      `,
    });

    if (emailError) {
      console.error("Error sending email:", emailError);
      throw new Error("Erro ao enviar email: " + emailError.message);
    }

    console.log("Email sent successfully to:", email, "Email ID:", emailData?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Código enviado para " + email,
        user_id: userId,
        full_name: fullName,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-otp-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
