export function validateSourcingPayload(payload: Record<string, unknown>): string[] {
  const missing: string[] = [];
  if (typeof payload.product_name !== "string" || payload.product_name.trim().length === 0) {
    missing.push("product_name");
  }
  if (!(typeof payload.quantity === "number" && Number.isFinite(payload.quantity) && payload.quantity > 0)) {
    missing.push("quantity");
  }
  if (typeof payload.unit !== "string" || payload.unit.trim().length === 0) {
    missing.push("unit");
  }
  if (typeof payload.delivery_location !== "string" || payload.delivery_location.trim().length === 0) {
    missing.push("delivery_location");
  }
  return missing;
}
