import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
};
const randomCode = () => {
  const ceiling = Math.floor(0x100000000 / 1_000_000) * 1_000_000;
  const values = new Uint32Array(1);
  do crypto.getRandomValues(values); while (values[0] >= ceiling);
  return String(values[0] % 1_000_000).padStart(6, "0");
};
const randomToken = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
};
const getClientIp = (req: Request) => req.headers.get("cf-connecting-ip")?.trim() || "";
const constantTimeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN_EMAILS = [
  { email: "claudiohenriques@agrilink.ao", key: "claudio", label: "Cláudio Henriques" },
  { email: "m.lucamba@agrilink.ao", key: "moises", label: "Moisés Lucamba" },
] as const;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin") ?? "";
    if (origin !== "https://agrilink.ao" && origin !== "https://www.agrilink.ao") return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const origin = req.headers.get("origin") ?? "";
  if (origin && origin !== "https://agrilink.ao" && origin !== "https://www.agrilink.ao") return json({ error: "Origem não autorizada." }, 403);

  try {
    const authorization = req.headers.get("authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "Sessão administrativa necessária." }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Sessão inválida. Inicia sessão novamente." }, 401);
    const { data: allowed, error: permissionError } = await userClient.rpc("has_admin_permission", {
      _user_id: userData.user.id,
      _permission: "manage_admins",
    });
    if (permissionError || allowed !== true) return json({ error: "Não tens autorização para esta área." }, 403);

    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") ?? "";
    if (!ip || ip === "unknown" || !userAgent) return json({ error: "Não foi possível validar o IP e o dispositivo. Acesso bloqueado." }, 403);
    const userAgentHash = await sha256(userAgent);
    const service = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "start") {
      const { data: rateAllowed, error: rateError } = await service.rpc("consume_api_rate_limit", {
        p_bucket_key: `admin-bank-gate:user:${userData.user.id}:${await sha256(ip)}`,
        p_window_seconds: 900,
        p_max_requests: 3,
      });
      if (rateError || rateAllowed !== true) return json({ error: "Limite de pedidos atingido. Tenta novamente mais tarde." }, 429);

      await service.from("admin_bank_access_challenges").update({ status: "expired" }).eq("user_id", userData.user.id).eq("status", "pending");\n      await service.from("admin_bank_access_challenges").delete().lt("expires_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());\n      const codes = [randomCode(), randomCode()];
      const challengeId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const [claudioHash, moisesHash] = await Promise.all([
        sha256(`${challengeId}:claudio:${codes[0]}`),
        sha256(`${challengeId}:moises:${codes[1]}`),
      ]);
      const { error: insertError } = await service.from("admin_bank_access_challenges").insert({
        id: challengeId,
        user_id: userData.user.id,
        ip_address: ip,
        user_agent_hash: userAgentHash,
        claudio_code_hash: claudioHash,
        moises_code_hash: moisesHash,
        expires_at: expiresAt,
      });
      if (insertError) throw new Error("Não foi possível iniciar a verificação de segurança.");\n      await service.from("audit_logs").insert({ user_id: userData.user.id, action: "admin_bank_access.requested", event_type: "ADMIN_BANK_ACCESS_REQUESTED", details: { challenge_id: challengeId, ip_address: ip, user_agent_hash: userAgentHash, recipients: ADMIN_EMAILS.map((item) => item.email) } });

      const messages = ADMIN_EMAILS.map((recipient, index) => ({
        dedupe_key: `admin-bank-gate:${challengeId}:${recipient.key}`,
        recipient: recipient.email,
        subject: "Código de autorização — área bancária AgriLink",
        template: "notification",
        priority: 100,
        scheduled_at: new Date().toISOString(),
        payload: {
          title: "Autorização de acesso à área bancária",
          full_name: recipient.label,
          message: `Código de acesso: ${codes[index]}. Este código expira em 10 minutos. Pedido iniciado por: ${userData.user.email ?? "administrador"}; IP público observado: ${ip}. Se não reconheces este pedido, não partilhes o código e contacta a administração.`,
        },
      }));
      const { error: queueError } = await service.from("email_outbox").insert(messages);
      if (queueError) {
        await service.from("admin_bank_access_challenges").update({ status: "revoked" }).eq("id", challengeId);
        throw new Error("Não foi possível enviar os códigos de autorização. Nenhum acesso foi concedido.");
      }
      return json({ success: true, challenge_id: challengeId, ip_address: ip, expires_at: expiresAt, required_approvals: 2 }, 202);
    }

    if (action === "verify") {
      const challengeId = String(body?.challenge_id ?? "");
      const recipientKey = String(body?.recipient ?? "");
      const code = String(body?.code ?? "").trim();
      if (!/^[0-9a-f-]{36}$/i.test(challengeId) || !["claudio", "moises"].includes(recipientKey) || !/^\d{6}$/.test(code)) {
        return json({ error: "Código ou pedido inválido." }, 400);
      }
      const { data: challenge, error: challengeError } = await service.from("admin_bank_access_challenges")
        .select("*").eq("id", challengeId).eq("user_id", userData.user.id)
        .eq("ip_address", ip).eq("user_agent_hash", userAgentHash)
        .eq("status", "pending").gt("expires_at", new Date().toISOString()).maybeSingle();
      if (challengeError || !challenge) return json({ error: "Pedido expirado, alterado ou associado a outro dispositivo. Inicia novamente." }, 403);
      if (challenge.attempts >= 10) {
        await service.from("admin_bank_access_challenges").update({ status: "locked" }).eq("id", challengeId);
        return json({ error: "Limite de tentativas excedido. Inicia um novo pedido." }, 429);
      }
      const expected = recipientKey === "claudio" ? challenge.claudio_code_hash : challenge.moises_code_hash;
      const actual = await sha256(`${challengeId}:${recipientKey}:${code}`);
      if (!constantTimeEqual(actual, expected)) {
        const nextAttempts = Number(challenge.attempts) + 1;
        await service.from("admin_bank_access_challenges").update({
          attempts: nextAttempts,
          last_attempt_at: new Date().toISOString(),
          ...(nextAttempts >= 10 ? { status: "locked" } : {}),
        }).eq("id", challengeId).eq("status", "pending");
        return json({ error: "Código inválido. Verifica o email e tenta novamente." }, 400);
      }

      const approvedAt = new Date().toISOString();
      const approvalField = recipientKey === "claudio" ? "claudio_approved_at" : "moises_approved_at";
      const { error: approveError } = await service.from("admin_bank_access_challenges")
        .update({ [approvalField]: approvedAt, last_attempt_at: approvedAt })
        .eq("id", challengeId).eq("status", "pending");
      if (approveError) throw new Error("Não foi possível registar a aprovação.");

      const { data: refreshed, error: refreshError } = await service.from("admin_bank_access_challenges")
        .select("claudio_approved_at,moises_approved_at,status")
        .eq("id", challengeId).single();
      if (refreshError) throw new Error("Não foi possível confirmar as aprovações.");

      if (!refreshed.claudio_approved_at || !refreshed.moises_approved_at) {
        return json({ success: true, fully_authorized: false, message: "Primeira aprovação validada. Falta a aprovação do segundo responsável." });
      }

      const accessToken = randomToken();
      const accessTokenHash = await sha256(accessToken);
      const accessExpiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
      const { data: granted, error: grantError } = await service.from("admin_bank_access_challenges").update({
        status: "approved",
        access_token_hash: accessTokenHash,
        access_expires_at: accessExpiresAt,
      }).eq("id", challengeId).eq("status", "pending").select("id").maybeSingle();
      if (grantError || !granted) throw new Error("O pedido já foi concluído ou alterado. Inicia uma nova verificação.");
      return json({ success: true, fully_authorized: true, access_token: accessToken, expires_at: accessExpiresAt });
    }

    if (action === "status") {
      const token = String(body?.access_token ?? "");
      if (!/^[0-9a-f]{64}$/i.test(token)) return json({ authorized: false });
      const tokenHash = await sha256(token);
      const { data: grant } = await service.from("admin_bank_access_challenges")
        .select("id").eq("user_id", userData.user.id).eq("ip_address", ip)
        .eq("user_agent_hash", userAgentHash).eq("access_token_hash", tokenHash)
        .eq("status", "approved").gt("access_expires_at", new Date().toISOString()).maybeSingle();
      return json({ authorized: Boolean(grant) });
    }

    return json({ error: "Operação não reconhecida." }, 400);
  } catch (error) {
    console.error("admin-bank-coordinates-gate:", error instanceof Error ? error.message : "unknown");
    return json({ error: "Não foi possível concluir a verificação de segurança. Nenhum acesso foi concedido." }, 500);
  }
});
