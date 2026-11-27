import { PaymentProviderRegistry } from "./provider.ts";
import type { PaymentProviderAdapter } from "./provider.ts";

const adapters: PaymentProviderAdapter[] = [];

export const paymentProviderRegistry = new PaymentProviderRegistry(adapters);