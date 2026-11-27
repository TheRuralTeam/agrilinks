const PAYMENT_AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/;

export function normalizePaymentAmount(amount: string): string {
  if (!PAYMENT_AMOUNT_PATTERN.test(amount)) {
    throw new Error("Invalid payment amount");
  }

  const [whole, fraction = ""] = amount.split(".");
  const normalized = `${whole}.${fraction.padEnd(2, "0")}`;
  if (/^0\.00$/.test(normalized)) throw new Error("Payment amount must be positive");
  return normalized;
}