import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2.57.4/cors";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const BodySchema = z.object({
  email: z.string().trim().email().max(255),
  code: z.string().trim().regex(/^\d{6}$/),
});

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Código ou email inválido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = parsed.data.email.toLowerCase();
    const code = parsed.data.code;
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Serviço de verificação indisponível." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: otpRow, error: otpError } = await supabase
      .from("email_verification_codes")
      .select("id,user_id")
      .eq("email", email)
      .eq("code", code)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) {
      console.error("OTP lookup failed:", otpError);
      return new Response(JSON.stringify({ error: "Não foi possível verificar o código." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!otpRow?.user_id) {
      return new Response(JSON.stringify({ error: "Código incorreto ou expirado." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: authError } = await supabase.auth.admin.updateUserById(otpRow.user_id, {
      email_confirm: true,
    });

    if (authError) {
      console.error("Auth confirmation failed:", authError);
      return new Response(JSON.stringify({ error: "Não foi possível confirmar a conta." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: profileError } = await supabase
      .from("users")
      .update({ email_verified: true, updated_at: new Date().toISOString() })
      .eq("id", otpRow.user_id);

    if (profileError) {
      console.error("Profile confirmation failed:", profileError);
      return new Response(JSON.stringify({ error: "Conta confirmada, mas o perfil não foi atualizado." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("email_verification_codes")
      .update({ verified: true })
      .eq("id", otpRow.id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("verify-otp-email error:", error);
    return new Response(JSON.stringify({ error: "Erro inesperado na verificação." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});