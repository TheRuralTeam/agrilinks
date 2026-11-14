export type BuyerCartItem = {
  product_id: string;
  product_name: string;
  seller_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  available_quantity: number;
  minimum_quantity: number;
  package_weight_kg: number | null;
  harvest_date: string | null;
  province: string;
  municipality: string;
};

const cartKey = (userId: string) => `agrilink:buyer-cart:${userId}`;

const checkoutKey = (userId: string) => `agrilink:buyer-cart-checkout:${userId}`;

function createIdempotencyUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

/** Returns the same checkout key after reload until the cart or checkout details change. */
export function readBuyerCartIdempotencyKey(userId: string): string {
  if (typeof window === 'undefined') return createIdempotencyUuid();
  try {
    const stored = window.localStorage.getItem(checkoutKey(userId));
    if (stored && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored)) return stored;
    const next = createIdempotencyUuid();
    window.localStorage.setItem(checkoutKey(userId), next);
    return next;
  } catch {
    return createIdempotencyUuid();
  }
}

export function writeBuyerCartIdempotencyKey(userId: string, key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(checkoutKey(userId), key);
  } catch {
    // Checkout still works for the current session; the server validates the key.
  }
}

export function readBuyerCart(userId: string): BuyerCartItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(cartKey(userId)) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is BuyerCartItem =>
      Boolean(item && typeof item.product_id === 'string' && typeof item.product_name === 'string')
    );
  } catch {
    return [];
  }
}

export const BUYER_CART_UPDATED_EVENT = 'agrilink:buyer-cart-updated';

/**
 * Counts distinct product types in the cart, not kilograms or requested units.
 * Increasing the quantity/weight of an existing product does not increase this badge.
 */
export function getBuyerCartQuantity(userId: string): number {
  return new Set(readBuyerCart(userId).map((item) => item.product_id)).size;
}

export function writeBuyerCart(userId: string, items: BuyerCartItem[]) {
  localStorage.setItem(cartKey(userId), JSON.stringify(items));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BUYER_CART_UPDATED_EVENT, {
      detail: { userId, quantity: new Set(items.map((item) => item.product_id)).size },
    }));
  }
}

export function addBuyerCartItem(userId: string, item: BuyerCartItem) {
  const items = readBuyerCart(userId);
  const existing = items.find((line) => line.product_id === item.product_id);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + item.quantity, item.available_quantity);
    existing.unit_price = item.unit_price;
    existing.available_quantity = item.available_quantity;
    existing.minimum_quantity = item.minimum_quantity;
  } else {
    items.push(item);
  }
  writeBuyerCart(userId, items);
  return items;
}
