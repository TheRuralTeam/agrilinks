import type { VercelRequest, VercelResponse } from "@vercel/node";
import { firewallGuard } from "../_security/firewall";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const route = typeof req.body?.route === "string" ? req.body.route : "/";
    const limit = Number(req.body?.limit ?? 60);
    const windowSeconds = Number(req.body?.windowSeconds ?? 60);

    if (!Number.isInteger(limit) || !Number.isInteger(windowSeconds)) {
      return res.status(400).json({ error: "invalid_rate_limit" });
    }

    const result = await firewallGuard({
      route,
      method: req.method,
      ip: req.headers["x-forwarded-for"]?.toString() || req.socket.remoteAddress,
      userAgent: req.headers["user-agent"]?.toString(),
      limit: Math.min(Math.max(limit, 1), 10000),
      windowSeconds: Math.min(Math.max(windowSeconds, 1), 86400),
    });

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(result.status).json({
      allowed: result.allowed,
      reason: result.reason,
    });
  } catch {
    return res.status(503).json({ error: "security_unavailable" });
  }
}
