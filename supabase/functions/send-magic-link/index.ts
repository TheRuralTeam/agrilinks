import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/http.ts";
import { z } from "npm:zod@3.23.8";

const AuthTypeSchema = z.enum([
  "magiclink",
  "signup",
  "email",
  "recovery",
]);

const BodySchema = z.object({
  email: z.string().trim().email().max(255),
  full_name: z.string().trim().min(1).max(120).optional(),
  redirect_to: z.string().trim().url().max(500).optional(),
  type: AuthTypeSchema.optional().default("magiclink"),
});

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY",
);
const ALLOWED_HOSTS = [
  "agrilink.ao",
  "www.agrilink.ao",
  "localhost",
];

const DEFAULT_REDIRECT =
  "https://agrilink.ao/auth/callback?next=/app";

const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const EMAIL_MAX_REQUESTS = 3;
const IP_MAX_REQUESTS = 20;

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const getClientIp = (req: Request) =>
  req.headers.get("cf-connecting-ip")?.trim()
  || req.headers.get("x-real-ip")?.trim()
  || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  || "unknown";

const consumeRateLimit = async (bucketKey: string, maxRequests: number) => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_api_rate_limit`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY || "",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY || ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_bucket_key: bucketKey,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      p_max_requests: maxRequests,
    }),
  });
  if (!response.ok) throw new Error("Não foi possível validar o limite de envio.");
  return (await response.json()) === true;
};

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
    const allowed = ALLOWED_HOSTS.includes(hostname);
    const isLocalhost = hostname === "localhost";
    const validProtocol = isLocalhost
      ? url.protocol === "http:" || url.protocol === "https:"
      : url.protocol === "https:";
    const validPort = isLocalhost || !url.port;
    const validPath = url.pathname === "/auth/callback";

    if (
      !allowed ||
      !validProtocol ||
      !validPort ||
      !validPath ||
      url.username ||
      url.password
    ) {
      console.warn("Redirect rejeitado por não corresponder ao callback autorizado.");
      return DEFAULT_REDIRECT;
    }

    return url.toString();
  } catch {
    return DEFAULT_REDIRECT;
  }
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
    const authType = parsed.data.type ?? "magiclink";

    const emailHash = await sha256(`magic-link:email:${email}`);
    const ipHash = await sha256(`magic-link:ip:${getClientIp(req)}`);
    const emailAllowed = await consumeRateLimit(`auth:magic-link:email:${emailHash}`, EMAIL_MAX_REQUESTS);
    const ipAllowed = await consumeRateLimit(`auth:magic-link:ip:${ipHash}`, IP_MAX_REQUESTS);
    if (!emailAllowed || !ipAllowed) {
      return new Response(JSON.stringify({
        success: false,
        error: "Atingiste o limite de pedidos de link. Tenta novamente mais tarde.",
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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

    const subject = authType === "recovery"
      ? "Recupere a sua palavra-passe — AgriLink"
      : authType === "signup"
        ? "Ative a sua conta — AgriLink"
        : "Confirme o seu email — AgriLink";
    const serviceKey = SUPABASE_SERVICE_ROLE_KEY;
    const [queued, queueOk] = await fetch(`${SUPABASE_URL}/rest/v1/email_outbox`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation,resolution=ignore-duplicates",
      },
      body: JSON.stringify({
        dedupe_key: `auth:${authType}:${email}:${Math.floor(Date.now() / 60000)}`,
        recipient: email,
        subject,
        template: authType === "recovery" ? "auth-recovery" : "auth-magic-link",
        priority: 100,
        payload: { email, full_name: fullName, redirect_to: redirectTo, auth_type: authType },
      }),
    }).then(async (response) => [await response.json().catch(() => null), response.ok] as const);
    if (!queueOk) throw new Error(queued?.message || "Não foi possível agendar o link.");

    /**
     * Resposta final.
     */
    return new Response(
      JSON.stringify({
        success: true,
        queued: true,
        message: "Link agendado para envio.",
        email,
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