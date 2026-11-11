import { createClient } from "@supabase/supabase-js";

type FirewallOptions = {
  route: string;
  method?: string;
  ip?: string | null;
  userId?: string | null;
  userAgent?: string | null;
  limit?: number;
  windowSeconds?: number;
  action?: string;
};

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const normalizeIp = (value?: string | null) =>
  (value || "unknown").split(",")[0].trim().slice(0, 128);

export async function firewallGuard(options: FirewallOptions) {
  const ip = normalizeIp(options.ip);
  const route = options.route || "/";
  const method = options.method || "GET";
  const limit = options.limit ?? 60;
  const windowSeconds = options.windowSeconds ?? 60;
  const bucket = `ip:${ip}:${route}`;

  const { data: blocked, error: blockedError } = await admin.rpc(
    "is_blocked",
    { p_identifier: ip, p_identifier_type: "ip" },
    { schema: "security" },
  );

  if (blockedError) {
    await logFirewallEvent({ ...options, ip, action: "firewall_error", riskScore: 50 });
    return { allowed: false, status: 503, reason: "security_unavailable" as const };
  }

  if (blocked) {
    await logFirewallEvent({ ...options, ip, action: "blocked_ip", riskScore: 100 });
    return { allowed: false, status: 403, reason: "blocked" as const };
  }

  const { data: allowed, error: rateError } = await admin.rpc(
    "consume",
    {
      p_bucket_key: bucket,
      p_window_seconds: windowSeconds,
      p_max_requests: limit,
    },
    { schema: "security" },
  );

  if (rateError || !allowed) {
    await logFirewallEvent({
      ...options,
      ip,
      action: "rate_limited",
      statusCode: 429,
      riskScore: 70,
      reason: "rate_limit_exceeded",
    });
    return { allowed: false, status: 429, reason: "rate_limited" as const };
  }

  return { allowed: true, status: 200 as const };
}

async function logFirewallEvent(input: FirewallOptions & {
  ip: string;
  action: string;
  statusCode?: number;
  riskScore?: number;
  reason?: string;
}) {
  await admin.rpc(
    "record_event",
    {
      p_identifier: input.ip,
      p_identifier_type: "ip",
      p_user_id: input.userId ?? null,
      p_action: input.action,
      p_route: input.route,
      p_method: input.method ?? "GET",
      p_status_code: input.statusCode ?? 200,
      p_risk_score: input.riskScore ?? 0,
      p_reason: input.reason ?? null,
      p_user_agent: input.userAgent ?? null,
      p_metadata: {},
    },
    { schema: "security" },
  );
}
