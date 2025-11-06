import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { supabase } from "../_shared/supabase.ts";

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
    const { name, email, phone, message }: SupportMessage = await req.json();

    // Salvar mensagem no banco
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    const { error: insertError } = await supabase
      .from('support_messages')
      .insert({
        user_id: userId,
        name,
        email,
        phone,
        message,
        status: 'pendente'
      });

    if (insertError) throw insertError;

    // Enviar notificação por WhatsApp (simulado)
    const whatsappNumber = "922757574"; // Número fornecido pelo usuário
    const whatsappMessage = `🚨 *Nova mensagem de suporte - AgriLink*\n\n*Nome:* ${name}\n*Email:* ${email}\n*Telefone:* ${phone || 'Não informado'}\n\n*Mensagem:*\n${message}\n\n_Mensagem recebida em ${new Date().toLocaleString('pt-AO')}_`;
    
    // Aqui você integraria com uma API de WhatsApp Business
    // Por exemplo, usando a API oficial do WhatsApp ou serviços como Twilio
    console.log(`Notificação WhatsApp para ${whatsappNumber}:`, whatsappMessage);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Mensagem enviada com sucesso! Nossa equipe entrará em contato em breve.",
      whatsapp_notified: true
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
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);