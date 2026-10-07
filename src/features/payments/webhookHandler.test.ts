import { describe, expect, it, beforeAll, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { createPaymentWebhookHandler } from '../../../supabase/functions/_shared/payments/webhookHandler'
import { PaymentProviderRegistry } from '../../../supabase/functions/_shared/payments/provider'
import type { PaymentProviderAdapter, VerifiedPaymentWebhook } from '../../../supabase/functions/_shared/payments/provider'

const verifiedEvent: VerifiedPaymentWebhook = {
  eventId: 'event-1',
  eventType: 'payment.succeeded',
  providerReference: 'provider-reference-1',
  status: 'succeeded',
  amount: '125.00',
  currency: 'AOA',
  bodySha256: '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
}

function registryFor(event = verifiedEvent) {
  const adapter: PaymentProviderAdapter = {
    id: 'provider-a',
    createCheckout: async () => ({ providerReference: 'provider-reference-1' }),
    verifyWebhook: vi.fn(async () => event),
  }
  return { registry: new PaymentProviderRegistry([adapter]), adapter }
}

function webhookRequest(body = '{}', path = 'provider-a') {
  return new Request(`https://edge.example/payment-webhook/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
}

describe('payment webhook handler', () => {
  beforeAll(() => {
    vi.stubGlobal('crypto', webcrypto)
  })

  it('persists only an event returned by the provider signature verifier', async () => {
    const { registry, adapter } = registryFor()
    const apply = vi.fn(async () => ({ data: 'processed', error: null }))
    const response = await createPaymentWebhookHandler(registry, apply)(webhookRequest())

    expect(response.status).toBe(200)
    expect(adapter.verifyWebhook).toHaveBeenCalledOnce()
    expect(apply).toHaveBeenCalledWith({
      providerId: 'provider-a',
      providerEventId: verifiedEvent.eventId,
      eventType: verifiedEvent.eventType,
      bodySha256: verifiedEvent.bodySha256,
      providerReference: verifiedEvent.providerReference,
      providerStatus: verifiedEvent.status,
      amount: verifiedEvent.amount,
      currency: verifiedEvent.currency,
    })
  })

  it('rejects unverifiable events without calling the database', async () => {
    const { registry, adapter } = registryFor()
    vi.mocked(adapter.verifyWebhook).mockRejectedValueOnce(new Error('bad signature'))
    const apply = vi.fn()
    const response = await createPaymentWebhookHandler(registry, apply)(webhookRequest())

    expect(response.status).toBe(401)
    expect(apply).not.toHaveBeenCalled()
  })

  it('rejects an adapter hash that does not match the raw request bytes', async () => {
    const { registry } = registryFor({ ...verifiedEvent, bodySha256: 'b'.repeat(64) })
    const apply = vi.fn()
    const response = await createPaymentWebhookHandler(registry, apply)(webhookRequest())

    expect(response.status).toBe(401)
    expect(apply).not.toHaveBeenCalled()
  })

  it('returns retryable status when the payment intent is not ready yet', async () => {
    const { registry } = registryFor()
    const apply = vi.fn(async () => ({ data: 'retry', error: null }))
    const response = await createPaymentWebhookHandler(registry, apply)(webhookRequest())

    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('10')
  })

  it('rejects event-id reuse with a different signed payload', async () => {
    const { registry } = registryFor()
    const apply = vi.fn(async () => ({ data: 'duplicate_payload_mismatch', error: null }))
    const response = await createPaymentWebhookHandler(registry, apply)(webhookRequest())

    expect(response.status).toBe(409)
  })

  it('rejects oversized and unsupported provider requests', async () => {
    const { registry } = registryFor()
    const apply = vi.fn()
    const handler = createPaymentWebhookHandler(registry, apply)
    const oversized = await handler(webhookRequest('x'.repeat(65 * 1024)))
    const unsupported = await handler(webhookRequest('{}', 'unknown-provider'))

    expect(oversized.status).toBe(413)
    expect(unsupported.status).toBe(503)
    expect(apply).not.toHaveBeenCalled()
  })

  it('allows safe duplicate outcomes and retries storage errors', async () => {
    const { registry } = registryFor()
    const handler = createPaymentWebhookHandler
    const duplicate = await handler(registry, async () => ({ data: 'duplicate', error: null }))(webhookRequest())
    const storageError = await handler(registry, async () => ({
      data: null,
      error: { message: 'database unavailable' },
    }))(webhookRequest())

    expect(duplicate.status).toBe(200)
    expect(storageError.status).toBe(503)
  })
})