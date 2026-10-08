export interface AgriLinkNotificationTarget {
  id: string;
  type: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * Resolve a notification to an internal route. Explicit metadata paths are
 * accepted only when they are same-origin relative paths, never external URLs.
 */
export function getNotificationTargetPath(notification: AgriLinkNotificationTarget): string {
  const metadata = notification.metadata ?? {};
  const explicitPath = metadata.path;

  if (typeof explicitPath === "string" && explicitPath.startsWith("/") && !explicitPath.startsWith("//") && !explicitPath.includes("\\")) {
    try {
      const parsed = new URL(explicitPath, window.location.origin);
      if (parsed.origin === window.location.origin) return parsed.pathname + parsed.search + parsed.hash;
    } catch {
      // Fall through to a type-based destination.
    }
  }

  const value = (...keys: string[]) => {
    for (const key of keys) {
      const candidate = metadata[key];
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return null;
  };

  const type = notification.type.toLowerCase();
  const conversationId = value("conversation_id", "conversationId", "conversation_id");
  const productId = value("product_id", "productId");
  const orderId = value("pre_order_id", "order_id", "preOrderId");
  const fichaId = value("ficha_id", "fichaId");

  if (type === "message" && conversationId) return `/messages/${encodeURIComponent(conversationId)}`;
  if (type === "message" || type === "chat") return "/listamensagens";
  if (type.startsWith("pre_order") || type.includes("order")) {
    return orderId ? `/dashboard?order=${encodeURIComponent(orderId)}` : "/dashboard";
  }
  if (type.includes("ficha") && fichaId) return `/ficharecebimento?ficha=${encodeURIComponent(fichaId)}`;
  if (type === "product" || type.includes("product")) {
    return productId ? `/app?product=${encodeURIComponent(productId)}` : "/app";
  }
  if (type === "referral" || type.includes("agent")) return "/dashboard";
  if (type === "support") return "/suporte";

  return "/notificacoes";
}
