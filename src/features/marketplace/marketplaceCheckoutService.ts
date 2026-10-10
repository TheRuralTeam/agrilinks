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


export interface AuthorizedPaymentRecipient {
  id: string
  display_name: string
  channel: 'bank_transfer' | 'multicaixa_express' | 'unitel_money' | 'afrimoney' | 'paypay'
  account_identifier: string
  account_holder: string
  instructions: string | null
  currency: string
}

export async function getMarketplacePaymentRecipients(preOrderId: string) {
  const { data, error } = await supabase.rpc('get_marketplace_payment_recipients', {
    p_pre_order_id: preOrderId,
  })
  if (error) throw error
  return (data ?? []) as AuthorizedPaymentRecipient[]
}

export async function createAuthorizedRecipientPaymentIntent(
  preOrderId: string,
  recipientId: string,
) {
  const { data, error } = await supabase.rpc('create_authorized_recipient_payment_intent', {
    p_pre_order_id: preOrderId,
    p_recipient_id: recipientId,
    p_idempotency_key: crypto.randomUUID(),
  })
  if (error) throw error
  return (Array.isArray(data) ? data[0] : data) as {
    intent_id: string
    pre_order_id: string
    amount: number
    currency: string
    status: string
    recipient_id: string
    recipient_name: string
    account_identifier: string
  }
}

export async function submitAuthorizedRecipientPaymentProof(
  intentId: string,
  transferReference: string,
  note?: string,
) {
  const { data, error } = await supabase.rpc('submit_authorized_recipient_payment_proof', {
    p_intent_id: intentId,
    p_transfer_reference: transferReference,
    ...(note !== undefined ? { p_note: note } : {}),
  })
  if (error) throw error
  return data as boolean
}
