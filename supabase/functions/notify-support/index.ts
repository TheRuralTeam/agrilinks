import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SupportMessage {
  name: string;
  email: string;
  phone?: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json().catch(() => ({}));
    const { name, email, phone, message }: SupportMessage = rawBody ?? {};

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: "name, email e message são obrigatórios." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;

    const { error: insertError } = await supabase
      .from("support_messages")
      .insert({
        user_id: userId,
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        phone: phone ? String(phone).trim() : null,
        message: String(message).trim(),
        status: "pendente",
      });

    if (insertError) throw insertError;

    const whatsappNumber = "922757574";
    const whatsappMessage = `🚨 *Nova mensagem de suporte - AgriLink*\n\n*Nome:* ${String(name).trim()}\n*Email:* ${String(email).trim().toLowerCase()}\n*Telefone:* ${phone ? String(phone).trim() : "Não informado"}\n\n*Mensagem:*\n${String(message).trim()}\n\n_Mensagem recebida em ${new Date().toLocaleString("pt-AO")}_`;

    console.log(`Notificação WhatsApp para ${whatsappNumber}:`, whatsappMessage);

    return new Response(JSON.stringify({
      success: true,
      message: "Mensagem enviada com sucesso! Nossa equipe entrará em contato em breve.",
      whatsapp_notified: true,
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in notify-support function:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Erro interno ao processar o pedido." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);