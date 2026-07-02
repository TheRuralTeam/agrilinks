import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendOtpRequest {
  user_id: string;
  email: string;
  full_name: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, email, full_name }: SendOtpRequest = await req.json();

    console.log("Generating OTP for:", email);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Generate OTP using database function
    const { data: otpCode, error: otpError } = await supabase.rpc('generate_email_otp', {
      p_user_id: user_id,
      p_email: email
    });

    if (otpError) {
      console.error("Error generating OTP:", otpError);
      throw new Error("Erro ao gerar código OTP");
    }

    console.log("OTP generated:", otpCode);

    // Send email using Resend
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "AgriLink <no-reply@agrilink.ao>",
      to: [email],
      subject: `${otpCode} é o seu código AgriLink`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff;">
          <div style="text-align: center; margin-bottom: 30px; padding: 24px 0; border-bottom: 3px solid #7CB342;">
            <h1 style="color: #7CB342; margin: 0; font-size: 28px; letter-spacing: -0.5px;">AgriLink</h1>
            <p style="color: #6b7280; margin: 6px 0 0; font-size: 13px;">Conectando o agronegócio</p>
          </div>

          <div style="background: #f7faf3; border: 1px solid #e5efd7; border-radius: 12px; padding: 32px; text-align: center;">
            <h2 style="color: #1f2937; margin: 0 0 8px; font-size: 20px;">Olá, ${full_name}!</h2>
            <p style="color: #6b7280; margin: 0 0 24px; font-size: 15px;">Use o código abaixo para confirmar o seu e-mail:</p>

            <div style="background: #7CB342; color: #ffffff; font-size: 34px; font-weight: 700; letter-spacing: 10px; padding: 20px 32px; border-radius: 10px; display: inline-block;">
              ${otpCode}
            </div>

            <p style="color: #6b7280; margin: 24px 0 0; font-size: 13px;">
              Este código expira em <strong style="color:#B07D0A;">15 minutos</strong>
            </p>
          </div>

          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 28px; line-height: 1.5;">
            Se não solicitaste este código, ignora este e-mail.<br/>
            © ${new Date().getFullYear()} AgriLink · agrilink.ao
          </p>
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
        message: "Código enviado para " + email
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
