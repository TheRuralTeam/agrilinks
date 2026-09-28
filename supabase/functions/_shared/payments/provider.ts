import { normalizePaymentAmount } from "./money.ts";

export type ProviderPaymentStatus =
  | "pending"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface CreateCheckoutInput {
  intentId: string;
  idempotencyKey: string;
  amount: string;
  currency: string;
  description: string;
  returnUrl: string;
}

export interface ProviderCheckout {
  providerReference: string;
  checkoutUrl?: string;
}

export interface VerifiedPaymentWebhook {
  eventId: string;
  eventType: string;
  providerReference: string;
  status: ProviderPaymentStatus;
  amount: string;
  currency: string;
  bodySha256: string;
}

export interface PaymentProviderAdapter {
  readonly id: string;
  readonly checkoutHosts: readonly string[];
  createCheckout(input: CreateCheckoutInput): Promise<ProviderCheckout>;
  verifyWebhook(request: Request): Promise<VerifiedPaymentWebhook>;
}

export class PaymentProviderRegistry {
  private readonly providers = new Map<string, PaymentProviderAdapter>();

  constructor(adapters: readonly PaymentProviderAdapter[]) {
    for (const adapter of adapters) {
      if (!/^[a-z][a-z0-9_-]{1,49}$/.test(adapter.id)) {
        throw new Error("Invalid payment provider id");
      }
      if (this.providers.has(adapter.id)) {
        throw new Error("Duplicate payment provider id");
      }
      this.providers.set(adapter.id, adapter);
    }
  }

  list(): string[] {
    return [...this.providers.keys()];
  }

  has(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  async createCheckout(providerId: string, input: CreateCheckoutInput): Promise<ProviderCheckout> {
    if (!/^[0-9a-f-]{36}$/i.test(input.idempotencyKey)) {
      throw new Error("Invalid payment idempotency key");
    }
    const amount = normalizePaymentAmount(input.amount);
    if (!/^[A-Z]{3}$/.test(input.currency)) throw new Error("Invalid payment currency");
    const returnUrl = new URL(input.returnUrl);
    if (returnUrl.protocol !== "https:") throw new Error("Payment return URL must use HTTPS");

    const provider = this.getProvider(providerId);
    return validateProviderCheckout(
      await provider.createCheckout({ ...input, amount }),
      provider.checkoutHosts,
    );
  }

  async verifyWebhook(providerId: string, request: Request): Promise<VerifiedPaymentWebhook> {
    const event = await this.getProvider(providerId).verifyWebhook(request);
    if (!event.eventId || event.eventId.length > 255
      || !event.eventType || event.eventType.length > 120
      || !event.providerReference || event.providerReference.length > 255
      || !/^[A-Z]{3}$/.test(event.currency)
      || !/^[0-9a-f]{64}$/.test(event.bodySha256)
      || !["pending", "processing", "succeeded", "failed", "cancelled"].includes(event.status)) {
      throw new Error("Invalid verified payment event");
    }
    return { ...event, amount: normalizePaymentAmount(event.amount) };
  }

  private getProvider(providerId: string): PaymentProviderAdapter {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error("Payment provider is not configured");
    return provider;
  }
}

export function validateProviderCheckout(
  checkout: ProviderCheckout,
  allowedHosts: readonly string[] = [],
): ProviderCheckout {
  if (!checkout.providerReference || checkout.providerReference.length > 255) {
    throw new Error("Invalid provider reference");
  }

  if (checkout.checkoutUrl) {
    const url = new URL(checkout.checkoutUrl);
    const hostname = url.hostname.toLowerCase();
    const hostAllowed = allowedHosts.some((host) => host.toLowerCase() === hostname);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error("Provider checkout URL must use HTTPS");
    }
    if (!hostAllowed) throw new Error("Provider checkout URL host is not allowed");
  }

  return checkout;
}
