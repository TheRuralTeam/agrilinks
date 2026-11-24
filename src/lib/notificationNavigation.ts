export interface AgriLinkNotificationTarget {
  id: string;
  type: string;
  metadata?: Record<string, unknown> | null;
}

export function getNotificationDisplayTitle(title: string, type: string): string {
  const trimmedTitle = title.trim();
  const normalizedTitle = trimmedTitle.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (trimmedTitle && normalizedTitle !== "nao") return trimmedTitle;

  const normalizedType = type.toLowerCase();
  if (normalizedType.includes("comment")) return "Novo comentário";
  if (normalizedType.includes("message") || normalizedType === "chat") return "Nova mensagem";
  if (normalizedType.includes("order")) return "Actualização de pedido";
  if (normalizedType.includes("product")) return "Actualização de produto";
  return "Notificação";
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
  const conversationId = value("conversation_id", "conversationId");
  const productId = value("product_id", "productId");

  if (type === "message" && conversationId) return `/messages/${encodeURIComponent(conversationId)}`;
  if (type === "message" || type === "chat") return "/listamensagens";
  if (type === "product_approval") return "/admindashboard?tab=products";
  if (type === "verification_admin") return "/admindashboard?tab=users";
  if (type.startsWith("pre_order") || type.includes("order")) {
    return "/perfil?tab=orders";
  }
  if (productId && (type.includes("comment") || type.includes("reaction") || type.includes("interest") || type.includes("like") || type === "product")) {
    const commentQuery = type.includes("comment") ? "?comments=1#comments" : "";
    return `/produto/${encodeURIComponent(productId)}${commentQuery}`;
  }
  if (type.includes("ficha")) return "/ficharecebimento";
  if (type === "product" || type.includes("product")) return "/perfil?tab=products";
  if (type === "sourcing") return "/admindashboard?tab=sourcing";
  if (type.includes("sourcing")) return "/perfil?tab=sourcing";
  if (type === "contract") return "/contratos-futuros";
  if (type === "referral" || type.includes("agent")) return "/perfil?tab=referrals";
  if (type === "verification") return "/perfil";
  if (type === "support") return "/suporte";

  return "/notificacoes";
}
