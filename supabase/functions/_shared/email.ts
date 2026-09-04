export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const DEFAULT_REDIRECT = "https://agrilink.ao/auth/callback?next=/app";
export const ALLOWED_HOSTS = [
  "agrilink.ao",
  "www.agrilink.ao",
  "agrilinks.lovable.app",
  "localhost",
];

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export function normalizeEmail(email: string): string {
  return String(email ?? "").trim().toLowerCase();
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function safeRedirect(candidate?: string, fallback = DEFAULT_REDIRECT): string {
  if (!candidate) return fallback;

  try {
    const url = new URL(candidate);
    const hostname = url.hostname.toLowerCase();
    const allowed = ALLOWED_HOSTS.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    );

    if (!allowed) {
      console.warn("Redirect rejeitado:", candidate);
      return fallback;
    }

    return url.toString();
  } catch {
    return fallback;
  }
}

export function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} não está configurada.`);
  }
  return value;
}

export function buildBrandEmailTemplate({
  title,
  preheader,
  headline,
  bodyHtml,
  ctaText,
  ctaHref,
  secondaryText,
}: {
  title: string;
  preheader: string;
  headline: string;
  bodyHtml: string;
  ctaText?: string;
  ctaHref?: string;
  secondaryText?: string;
}) {
  const ctaMarkup = ctaText && ctaHref
    ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0 18px;">
        <tr>
          <td align="center">
            <a href="${escapeHtml(ctaHref)}" style="display:inline-block;background:#14532d;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:10px;font-size:14px;font-weight:700;">
              ${escapeHtml(ctaText)}
            </a>
          </td>
        </tr>
      </table>
    `
    : "";

  const secondaryMarkup = secondaryText
    ? `<p style="margin:0 0 12px;color:#4b5563;font-size:14px;line-height:22px;">${secondaryText}</p>`
    : "";

  return `<!doctype html>
<html lang="pt-AO">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      ${escapeHtml(preheader)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:22px 28px 0;">
                <div style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#166534;font-weight:700;">AgriLink</div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 0;">
                <h1 style="margin:0;font-size:28px;line-height:1.3;color:#111827;">${escapeHtml(headline)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 6px;">
                <div style="font-size:16px;line-height:26px;color:#374151;">${bodyHtml}</div>
                ${secondaryMarkup}
                ${ctaMarkup}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 28px;border-top:1px solid #e5e7eb;font-size:12px;line-height:20px;color:#6b7280;">
                AgriLink · contacto@agrilink.ao<br />
                Este e-mail foi enviado automaticamente. Não responda a esta mensagem.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendResendEmail({
  to,
  subject,
  html,
  from = "AgriLink <no-reply@agrilink.ao>",
  replyTo = "contacto@agrilink.ao",
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}) {
  const apiKey = getRequiredEnv("RESEND_API_KEY");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: replyTo,
      subject,
      html,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "O Resend recusou o envio do email.");
  }

  return data;
}
