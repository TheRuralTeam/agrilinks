import { supabase } from '../../integrations/supabase/client'

export interface MarketplaceCheckoutSummary {
  pre_order_id: string
  product_total: number
  freight_total: number
  total: number
  currency: string
  payment_ready: boolean
  reason: string
}

function getMarketplacePaymentIdempotencyKey(preOrderId: string, providerId: string) {
  const storageKey = `agrilink:marketplace-payment:${providerId}:${preOrderId}`
  try {
    const storedKey = window.sessionStorage.getItem(storageKey)
    if (storedKey && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storedKey)) {
      return storedKey
    }

    const key = crypto.randomUUID()
    window.sessionStorage.setItem(storageKey, key)
    return key
  } catch {
    return crypto.randomUUID()
  }
}

export async function getMarketplaceCheckoutSummary(preOrderId: string) {
  const { data, error } = await supabase.rpc('get_marketplace_checkout_summary', {
    p_pre_order_id: preOrderId,
  })
  if (error) throw error
  return (Array.isArray(data) ? data[0] : data) as MarketplaceCheckoutSummary | null
}

export async function createMarketplacePaymentIntent(
  preOrderId: string,
  providerId: string,
) {
  const { data, error } = await supabase.functions.invoke(
    'create-marketplace-payment-intent',
    {
      body: {
        pre_order_id: preOrderId,
        provider_id: providerId,
        idempotency_key: getMarketplacePaymentIdempotencyKey(preOrderId, providerId),
      },
    },
  )

  if (error) throw error
  return data as {
    intent_id: string
    pre_order_id: string
    amount: string
    currency: string
    status: string
    checkout_url: string | null
  }
}

