export const DEFAULT_REDIRECT = "https://agrilink.ao/auth/callback?next=/app";
export const ALLOWED_HOSTS = [
  "agrilink.ao",
  "www.agrilink.ao",
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
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 12px;">
        <tr>
          <td align="left">
            <a href="${escapeHtml(ctaHref)}" style="display:inline-block;background:#176b3a;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:6px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;font-weight:700;">
              ${escapeHtml(ctaText)}
            </a>
          </td>
        </tr>
      </table>
    `
    : "";

  const secondaryMarkup = secondaryText
    ? `<p style="margin:18px 0 0;color:#526158;font-size:13px;line-height:21px;">${secondaryText}</p>`
    : "";

  return `<!doctype html>
<html lang="pt-AO">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f7f3;font-family:Arial,Helvetica,sans-serif;color:#1b2b20;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f7f3;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e1e9e1;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:26px 30px 22px;border-bottom:1px solid #e7eee7;">
                <img src="https://raw.githubusercontent.com/TheRuralTeam/agrilinks/main/src/assets/LogoAgriLinkOfficiallNoBackground.png" width="154" alt="AgriLink" style="display:block;width:154px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
              </td>
            </tr>
            <tr>
              <td style="padding:30px 30px 8px;">
                <h1 style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:25px;line-height:1.32;font-weight:700;letter-spacing:-0.35px;color:#173d27;">${escapeHtml(headline)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 30px 30px;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:25px;color:#35463a;">${bodyHtml}</div>
                ${secondaryMarkup}
                ${ctaMarkup}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 30px;background:#f7faf6;border-top:1px solid #e7eee7;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#68776b;">
                <strong style="font-weight:700;color:#245c37;">AgriLink</strong><br />
                <a href="https://agrilink.ao" style="color:#245c37;text-decoration:none;">agrilink.ao</a>
                <span style="padding:0 5px;color:#a3afa5;">|</span>
                <a href="mailto:contacto@agrilink.ao" style="color:#245c37;text-decoration:none;">contacto@agrilink.ao</a>
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
  const sender = Deno.env.get("RESEND_FROM") || from;
  const payload = JSON.stringify({
    from: sender,
    to: [to],
    reply_to: replyTo,
    subject,
    html,
  });
  let lastError = "O Resend recusou o envio do email.";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: payload,
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) return data;

      lastError = data?.message || data?.error || lastError;
      if (![408, 429, 500, 502, 503, 504].includes(response.status)) break;
    } catch (error) {
      lastError = error instanceof DOMException && error.name === "AbortError"
        ? "O Resend demorou demasiado tempo a responder."
        : error instanceof Error
          ? error.message
          : lastError;
    } finally {
      clearTimeout(timeout);
    }

    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }

  throw new Error(lastError);
}
