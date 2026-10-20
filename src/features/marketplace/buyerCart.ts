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

export function writeBuyerCart(userId: string, items: BuyerCartItem[]) {
  localStorage.setItem(cartKey(userId), JSON.stringify(items));
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
