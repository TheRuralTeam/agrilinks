import { supabase } from '../../integrations/supabase/client'

export type P2PPaymentChannel = 'bank_transfer' | 'multicaixa_express' | 'unitel_money' | 'afrimoney' | 'paypay'

export interface P2PApplication {
  id: string
  user_id: string
  status: string
  legal_name: string
  phone: string | null
  requested_channels: string[]
  notes: string | null
  rejection_reason: string | null
  created_at: string
  reviewed_at: string | null
}

export interface P2PBeneficiary {
  id: string
  user_id: string
  status: string
  availability_status: 'online' | 'busy' | 'offline'
  per_transaction_limit: number
  daily_limit: number
  monthly_limit: number
  simultaneous_limit: number
  completion_rate: number
  completed_count: number
  cancelled_count: number
  dispute_count: number
  average_completion_seconds: number
}

export interface P2PAccount {
  id: string
  beneficiary_id: string
  channel: P2PPaymentChannel
  account_identifier: string
  account_holder: string
  currency: string
  instructions: string | null
  max_amount: number
  active: boolean
  verified_at: string | null
}

export interface P2POrder {
  id: string
  buyer_id: string
  pre_order_id: string | null
  beneficiary_id: string | null
  beneficiary_account_id: string | null
  amount: number
  currency: string
  payment_channel: P2PPaymentChannel
  status: string
  transfer_reference: string | null
  expires_at: string
  created_at: string
}

export interface P2PMatch {
  id: string
  p2p_order_id: string
  beneficiary_id: string
  score: number
  status: string
  offered_at: string
  responded_at: string | null
}

export async function submitP2PBeneficiaryApplication(input: {
  legalName: string
  phone?: string
  channels: P2PPaymentChannel[]
  notes?: string
}) {
  if (!input.phone?.trim()) throw new Error('O telefone é obrigatório para solicitar a aprovação P2P.')
  const { data, error } = await supabase.rpc('submit_p2p_beneficiary_application', {
    p_legal_name: input.legalName,
    p_phone: input.phone.trim(),
    p_requested_channels: input.channels,
    ...(input.notes !== undefined ? { p_notes: input.notes } : {}),
  })
  if (error) throw error
  return data as string
}

export async function fetchMyP2PApplication() {
  const { data, error } = await supabase
    .from('p2p_beneficiary_applications')
    .select('id,user_id,status,legal_name,phone,requested_channels,notes,rejection_reason,created_at,reviewed_at')
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return (data?.[0] ?? null) as P2PApplication | null
}

export async function fetchMyP2PBeneficiary() {
  const { data, error } = await supabase
    .from('p2p_beneficiaries')
    .select('id,user_id,status,availability_status,per_transaction_limit,daily_limit,monthly_limit,simultaneous_limit,completion_rate,completed_count,cancelled_count,dispute_count,average_completion_seconds')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as P2PBeneficiary | null
}

export async function fetchMyP2PAccounts(beneficiaryId: string) {
  const { data, error } = await supabase
    .from('p2p_beneficiary_accounts')
    .select('id,beneficiary_id,channel,account_identifier,account_holder,currency,instructions,max_amount,active,verified_at')
    .eq('beneficiary_id', beneficiaryId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as P2PAccount[]
}

export async function fetchMyP2POrders(beneficiaryId?: string) {
  const { data, error } = await supabase.rpc('get_my_p2p_operations')
  if (error) throw error
  return (data ?? []) as P2POrder[]
}

export async function fetchP2PPaymentAccount(accountId: string) {
  const { data, error } = await supabase
    .from('p2p_beneficiary_accounts')
    .select('id,beneficiary_id,channel,account_identifier,account_holder,currency,instructions,max_amount,active,verified_at')
    .eq('id', accountId)
    .maybeSingle()
  if (error) throw error
  return data as P2PAccount | null
}

export async function setP2PBeneficiaryAvailability(status: 'online' | 'busy' | 'offline') {
  const { data, error } = await supabase.rpc('set_p2p_beneficiary_availability', { p_status: status })
  if (error) throw error
  return data as boolean
}

export async function fetchMyP2PMatches(beneficiaryId: string) {
  const { data, error } = await supabase
    .from('p2p_matches')
    .select('id,p2p_order_id,beneficiary_id,score,status,offered_at,responded_at')
    .eq('beneficiary_id', beneficiaryId)
    .eq('status', 'offered')
    .order('offered_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as P2PMatch[]
}

export async function acceptP2PMatch(matchId: string) {
  const { data, error } = await supabase.rpc('accept_p2p_match', { p_match_id: matchId })
  if (error) throw error
  return data as string
}

export async function confirmP2PPaymentReceived(orderId: string, note?: string) {
  const { data, error } = await supabase.rpc('confirm_p2p_payment_received', {
    p_p2p_order_id: orderId,
    ...(note !== undefined ? { p_note: note } : {}),
  })
  if (error) throw error
  return data as string
}

export async function submitP2PPaymentProof(orderId: string, reference: string, note?: string) {
  const { data, error } = await supabase.rpc('submit_p2p_payment_proof', {
    p_p2p_order_id: orderId,
    p_transfer_reference: reference,
    p_note: note ?? null,
  })
  if (error) throw error
  return data as string
}

export async function openP2PDispute(orderId: string, reason: string) {
  const { data, error } = await supabase.rpc('open_p2p_dispute', {
    p_p2p_order_id: orderId,
    p_reason: reason,
  })
  if (error) throw error
  return data as string
}

export async function createP2POrder(preOrderId: string, channel: P2PPaymentChannel) {
  const { data, error } = await supabase.rpc('create_p2p_order', {
    p_pre_order_id: preOrderId,
    p_payment_channel: channel,
  })
  if (error) throw error
  return data as string
}


export async function adminCompleteP2POrder(orderId: string, note?: string) {
  const { data, error } = await supabase.rpc('admin_complete_p2p_order', {
    p_p2p_order_id: orderId,
    p_note: note ?? null,
  })
  if (error) throw error
  return data as string
}
