import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/http.ts";

const webpush = await import("npm:web-push@3.6.7").then((m) => m.default);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);


function resolveNotificationPath(type: string, metadata: Record<string, unknown> | null): string {
  const data = metadata ?? {};
  const explicit = data.path;
  if (typeof explicit === "string" && explicit.startsWith("/") && !explicit.startsWith("//") && !explicit.includes("\\")) {
    try {
      const parsed = new URL(explicit, "https://agrilink.ao");
      if (parsed.origin === "https://agrilink.ao") return parsed.pathname + parsed.search + parsed.hash;
    } catch {
      // Use the safe type-based fallback below.
    }
  }

  const getId = (...keys: string[]) => {
    for (const key of keys) {
      const value = data[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
  };
  const normalizedType = type.toLowerCase();
  const conversationId = getId("conversation_id", "conversationId");

  if ((normalizedType === "message" || normalizedType === "chat") && conversationId) return `/messages/${encodeURIComponent(conversationId)}`;
  if (normalizedType === "message" || normalizedType === "chat") return "/listamensagens";
  if (normalizedType.startsWith("pre_order") || normalizedType.includes("order")) return "/perfil?tab=orders";
  if (normalizedType.includes("ficha")) return "/ficharecebimento";
  if (normalizedType === "product_approval") return "/admindashboard?tab=products";
  if (normalizedType === "verification_admin") return "/admindashboard?tab=users";
  if (normalizedType.includes("product")) return "/perfil?tab=products";
  if (normalizedType === "sourcing") return "/admindashboard?tab=sourcing";
  if (normalizedType.includes("sourcing")) return "/perfil?tab=sourcing";
  if (normalizedType === "contract") return "/contratos-futuros";
  if (normalizedType === "referral" || normalizedType.includes("agent")) return "/perfil?tab=referrals";
  if (normalizedType === "support") return "/suporte";
  return "/notificacoes";
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const { queue_id, dispatch_token } = await req.json();
    if (!queue_id || !dispatch_token) return json({ error: "queue_id e dispatch_token são obrigatórios." }, 400);

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!vapidPublicKey || !vapidPrivateKey) return json({ error: "VAPID keys not configured" }, 500);

    webpush.setVapidDetails("mailto:no-reply@agrilink.ao", vapidPublicKey, vapidPrivateKey);

    const { data: queue, error: queueError } = await supabase
      .from("notification_push_queue")
      .select("id,notification_id,dispatch_token,status,attempts")
      .eq("id", queue_id)
      .eq("dispatch_token", dispatch_token)
      .maybeSingle();

    if (queueError) throw queueError;
    if (!queue) return json({ error: "Fila de push não encontrada." }, 404);
    if (queue.status === "dispatched") return json({ success: true, duplicate: true });
    if (!["pending", "processing"].includes(queue.status)) return json({ success: false, status: queue.status }, 409);

    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .select("id,user_id,type,title,message,metadata")
      .eq("id", queue.notification_id)
      .maybeSingle();
    if (notificationError) throw notificationError;
    if (!notification) {
      await supabase.rpc("complete_notification_push_queue", { p_id: queue.id });
      return json({ success: true, skipped: "notification_missing" });
    }

    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("id,endpoint,auth_key,p256dh_key")
      .eq("user_id", notification.user_id);
    if (subError) throw subError;

    const payload = JSON.stringify({
      title: notification.title || "Notificação AgriLink",
      body: notification.message || "Você tem uma nova notificação.",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: {
        ...(notification.metadata ?? {}),
        notification_id: notification.id,
        type: notification.type,
        path: resolveNotificationPath(notification.type, notification.metadata as Record<string, unknown> | null),
      },
      tag: `agrilink-${notification.id}`,
      renotify: true,
      requireInteraction: false,
      vibrate: [200, 100, 200],
      silent: false,
    });

    if (!subscriptions || subscriptions.length === 0) {
      await supabase.rpc("complete_notification_push_queue", { p_id: queue.id });
      return json({ success: true, sent: 0, reason: "no_subscriptions" });
    }

    let successes = 0;
    const errors: string[] = [];

    await Promise.all(subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { auth: sub.auth_key, p256dh: sub.p256dh_key },
          },
          payload,
        );
        successes += 1;
      } catch (error: unknown) {
        const e = error as { statusCode?: number; message?: string };
        errors.push(e?.message || "Push delivery failed");
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }));

    if (successes > 0 || errors.every((message) => /410|404|expired|not.?found/i.test(message))) {
      await supabase.rpc("complete_notification_push_queue", { p_id: queue.id });
      return json({ success: true, sent: successes, failed: subscriptions.length - successes });
    }

    await supabase.rpc("fail_notification_push_queue", {
      p_id: queue.id,
      p_error: errors.join(" | ").slice(0, 2000),
      p_retry: true,
    });
    return json({ success: false, sent: successes, failed: subscriptions.length - successes }, 502);
  } catch (error) {
    console.error("dispatch-push-notification:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
