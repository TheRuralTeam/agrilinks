import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  email: z.string().trim().email().max(255),
  full_name: z.string().trim().min(1).max(120).optional(),
  redirect_to: z.string().trim().url().max(500).optional(),
});

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY",
);
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const RESEND_FROM =
  Deno.env.get("RESEND_FROM") ||
  "AgriLink <no-reply@agrilink.ao>";

const ALLOWED_HOSTS = [
  "agrilink.ao",
  "www.agrilink.ao",
  "agrilinks.lovable.app",
  "localhost",
];

const DEFAULT_REDIRECT =
  "https://agrilink.ao/auth/callback?next=/app";

/**
 * Escapa HTML para evitar injeção no email.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Verifica se a URL de redirect pertence a um domínio autorizado.
 */
function safeRedirect(candidate?: string): string {
  if (!candidate) {
    return DEFAULT_REDIRECT;
  }

  try {
    const url = new URL(candidate);
    const hostname = url.hostname.toLowerCase();

    const allowed = ALLOWED_HOSTS.some(
      (host) =>
        hostname === host ||
        hostname.endsWith(`.${host}`),
    );

    if (!allowed) {
      console.warn(
        "Redirect rejeitado:",
        candidate,
      );

      return DEFAULT_REDIRECT;
    }

    return url.toString();
  } catch {
    return DEFAULT_REDIRECT;
  }
}

/**
 * Envia email através do Resend.
 */
async function postResend(
  from: string,
  to: string,
  subject: string,
  html: string,
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: "contacto@agrilink.ao",
      subject,
      html,
    }),
  });

  const data = await response.json();
  return { ok: response.ok, data };
}

/**
 * Envia através do Resend com fallback para o remetente partilhado
 * quando o domínio agrilink.ao ainda não está verificado.
 */
async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY não está configurada.");
  }

  let attempt = await postResend(RESEND_FROM, to, subject, html);

  if (!attempt.ok) {
    console.error("Resend API error:", JSON.stringify(attempt.data));

    const message = String(
      attempt.data?.message || attempt.data?.error || "",
    ).toLowerCase();

    const domainIssue =
      message.includes("domain is not verified") ||
      message.includes("not verified") ||
      message.includes("domain");

    if (domainIssue) {
      console.warn("A tentar fallback com onboarding@resend.dev");
      attempt = await postResend(
        "AgriLink <onboarding@resend.dev>",
        to,
        subject,
        html,
      );
    }
  }

  if (!attempt.ok) {
    throw new Error(
      attempt.data?.message ||
        attempt.data?.error ||
        "O Resend recusou o envio do email.",
    );
  }

  return attempt.data;
}

Deno.serve(async (req: Request): Promise<Response> => {
  /**
   * CORS
   */
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  /**
   * Apenas POST
   */
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Método não permitido.",
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  try {
    /**
     * Verifica configuração básica.
     */
    if (
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      console.error(
        "Supabase environment variables ausentes.",
      );

      return new Response(
        JSON.stringify({
          error:
            "Configuração do Supabase incompleta.",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    /**
     * Lê o body.
     */
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: "JSON inválido.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    /**
     * Validação.
     */
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      console.error(
        "Validation error:",
        parsed.error.flatten(),
      );

      return new Response(
        JSON.stringify({
          error: "Email inválido.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const email = parsed.data.email
      .trim()
      .toLowerCase();

    const redirectTo = safeRedirect(
      parsed.data.redirect_to,
    );

    /**
     * Cliente administrativo.
     *
     * SERVICE_ROLE_KEY fica SOMENTE na Edge Function.
     */
    const supabaseAdmin = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    /**
     * Procura o nome do utilizador.
     *
     * Se a tabela users não existir ou não tiver
     * o email, simplesmente usamos o nome enviado
     * pelo frontend.
     */
    let fullName =
      parsed.data.full_name?.trim() ||
      "Utilizador AgriLink";

    try {
      const { data: userRow, error: userError } =
        await supabaseAdmin
          .from("users")
          .select("id, full_name")
          .eq("email", email)
          .maybeSingle();

      if (userError) {
        console.warn(
          "Não foi possível consultar users:",
          userError.message,
        );
      }

      if (userRow?.full_name) {
        fullName = userRow.full_name;
      }
    } catch (error) {
      console.warn(
        "Consulta users ignorada:",
        error,
      );
    }

    /**
     * Gera o Magic Link através do Supabase Auth.
     *
     * O token NÃO é criado manualmente.
     */
    const {
      data: linkData,
      error: linkError,
    } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo,
      },
    });

    if (linkError) {
      console.error(
        "Supabase generateLink error:",
        linkError,
      );

      return new Response(
        JSON.stringify({
          error:
            "Não foi possível gerar o Magic Link.",
          details: linkError.message,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    /**
     * O Supabase retorna o link de autenticação.
     */
    const actionLink =
      linkData?.properties?.action_link;

    if (!actionLink) {
      console.error(
        "Supabase não retornou action_link.",
        linkData,
      );

      return new Response(
        JSON.stringify({
          error:
            "O Supabase não retornou o Magic Link.",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    /**
     * Escapa nome para HTML.
     */
    const safeFullName =
      escapeHtml(fullName);

    /**
     * HTML do email.
     */
    const html = `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirme o seu email</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f4f7f3;
    font-family:Arial,Helvetica,sans-serif;
  "
>
  <div
    style="
      max-width:620px;
      margin:0 auto;
      padding:40px 18px;
    "
  >

    <div
      style="
        background:#ffffff;
        border:1px solid #dce7dc;
        border-radius:18px;
        overflow:hidden;
      "
    >

      <!-- Header -->
      <div
        style="
          padding:30px;
          background:#f5faed;
          border-bottom:4px solid #7cb342;
        "
      >
        <h1
          style="
            margin:0;
            color:#7cb342;
            font-size:30px;
          "
        >
          AgriLink
        </h1>

        <p
          style="
            margin:8px 0 0;
            color:#405247;
            font-size:13px;
            font-weight:bold;
            letter-spacing:1px;
            text-transform:uppercase;
          "
        >
          Confirmação de conta
        </p>
      </div>

      <!-- Content -->
      <div style="padding:34px 30px;">

        <h2
          style="
            margin:0 0 12px;
            color:#172019;
            font-size:22px;
          "
        >
          Olá, ${safeFullName}
        </h2>

        <p
          style="
            margin:0 0 26px;
            color:#435248;
            font-size:15px;
            line-height:1.7;
          "
        >
          Recebemos um pedido para aceder à sua
          conta AgriLink. Clique no botão abaixo
          para confirmar o seu email e continuar.
        </p>

        <!-- Button -->
        <div
          style="
            text-align:center;
            margin:30px 0;
          "
        >
          <a
            href="${actionLink}"
            target="_blank"
            style="
              display:inline-block;
              background:#7cb342;
              color:#ffffff;
              text-decoration:none;
              font-weight:bold;
              font-size:16px;
              padding:16px 30px;
              border-radius:10px;
            "
          >
            Confirmar o meu email
          </a>
        </div>

        <p
          style="
            margin:0;
            color:#6b7d70;
            font-size:13px;
            line-height:1.6;
          "
        >
          Este link é de utilização única e
          expira de acordo com a configuração
          do Supabase Auth.
        </p>

        <p
          style="
            margin-top:20px;
            color:#98a99d;
            font-size:12px;
            line-height:1.5;
            word-break:break-all;
          "
        >
          Se o botão não funcionar, copie e cole
          este endereço no navegador:
          <br /><br />
          ${escapeHtml(actionLink)}
        </p>

      </div>

      <!-- Footer -->
      <div
        style="
          padding:18px 30px;
          background:#fafcf9;
          border-top:1px solid #dce7dc;
          text-align:center;
        "
      >
        <p
          style="
            margin:0;
            color:#9aaba0;
            font-size:12px;
          "
        >
          AgriLink · contacto@agrilink.ao
        </p>
      </div>

    </div>

  </div>
</body>
</html>
`;

    /**
     * Envia pelo Resend.
     */
    const resendResult = await sendEmail(
      email,
      "Confirme o seu email — AgriLink",
      html,
    );

    console.log(
      "Magic Link enviado:",
      {
        email,
        resendId: resendResult?.id,
      },
    );

    /**
     * Resposta final.
     */
    return new Response(
      JSON.stringify({
        success: true,
        message:
          "Magic Link enviado com sucesso.",
        email,
        resend_id: resendResult?.id ?? null,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error(
      "send-magic-link fatal error:",
      error,
    );

    const message =
      error instanceof Error
        ? error.message
        : "Erro interno ao enviar o Magic Link.";

    return new Response(
      JSON.stringify({
        error: message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});