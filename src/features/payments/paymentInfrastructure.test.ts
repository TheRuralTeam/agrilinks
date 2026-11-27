import { describe, expect, it } from 'vitest'
import { importHmacSha256Key, sha256Hex, verifyHmacSha256 } from '../../../supabase/functions/_shared/payments/crypto'
import {
  PaymentProviderRegistry,
  validateProviderCheckout,
} from '../../../supabase/functions/_shared/payments/provider'
import type { PaymentProviderAdapter } from '../../../supabase/functions/_shared/payments/provider'
import { normalizePaymentAmount } from '../../../supabase/functions/_shared/payments/money'

const toArrayBuffer = (value: string) => new TextEncoder().encode(value).buffer as ArrayBuffer

function provider(id: string): PaymentProviderAdapter {
  return {
    id,
    checkoutHosts: [],
    capabilities: { checkout: true, statusQuery: false, refunds: false, webhookVerification: true, supportedCurrencies: ['AOA'] },
    createCheckout: async () => ({ providerReference: 'reference' }),
    verifyWebhook: async () => {
      throw new Error('Not used in registry tests')
    },
  }
}

describe('payment provider boundary', () => {
  it('starts with no active provider instead of advertising a fake one', async () => {
    const registry = new PaymentProviderRegistry([])
    expect(registry.list()).toEqual([])
    await expect(registry.createCheckout('appy-pay', {
      intentId: 'intent-1',
      idempotencyKey: '89c57103-1211-49fa-89f5-c05d8f71be02',
      amount: '100.00',
      currency: 'AOA',
      description: 'Wallet top-up',
      returnUrl: 'https://agrilink.ao/profile',
    })).rejects.toThrow('Payment provider is not configured')
  })

  it('rejects duplicate provider identifiers', () => {
    expect(() => new PaymentProviderRegistry([provider('provider-a'), provider('provider-a')]))
      .toThrow('Duplicate payment provider id')
  })

  it('accepts secure checkout URLs and rejects insecure redirects', () => {
    expect(validateProviderCheckout({
      providerReference: 'payment-123',
      checkoutUrl: 'https://psp.example/checkout/123',
    }, ['psp.example']).providerReference).toBe('payment-123')

    expect(() => validateProviderCheckout({
      providerReference: 'payment-123',
      checkoutUrl: 'http://psp.example/checkout/123',
    }, ['psp.example'])).toThrow('Provider checkout URL must use HTTPS')

    expect(() => validateProviderCheckout({
      providerReference: 'payment-123',
      checkoutUrl: 'https://untrusted.example/checkout/123',
    }, ['psp.example'])).toThrow('Provider checkout URL host is not allowed')
  })
})

describe('payment cryptography', () => {
  it('verifies the HMAC using Web Crypto and rejects tampered bodies', async () => {
    const secret = toArrayBuffer('test-only-key-material')
    const payload = toArrayBuffer('{"event":"paid"}')
    const signingKey = await crypto.subtle.importKey(
      'raw',
      secret,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const signature = await crypto.subtle.sign('HMAC', signingKey, payload)
    const verificationKey = await importHmacSha256Key(secret)

    await expect(verifyHmacSha256(payload, signature, verificationKey)).resolves.toBe(true)
    await expect(verifyHmacSha256(toArrayBuffer('{"event":"changed"}'), signature, verificationKey))
      .resolves.toBe(false)
  })

  it('returns a SHA-256 digest suitable for webhook audit deduplication', async () => {
    const digest = await sha256Hex(toArrayBuffer('provider event bytes'))
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('payment amount precision', () => {
  it('normalizes decimal strings without floating-point conversion', () => {
    expect(normalizePaymentAmount('10')).toBe('10.00')
    expect(normalizePaymentAmount('10.5')).toBe('10.50')
    expect(normalizePaymentAmount('1234567890123.45')).toBe('1234567890123.45')
  })

  it('rejects zero, negative, over-precision and out-of-range values', () => {
    for (const amount of ['0', '-1', '1.001', '10000000000000', '1e3']) {
      expect(() => normalizePaymentAmount(amount)).toThrow()
    }
  })
})
