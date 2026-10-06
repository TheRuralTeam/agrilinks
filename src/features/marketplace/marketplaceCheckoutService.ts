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
        idempotency_key: crypto.randomUUID(),
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
