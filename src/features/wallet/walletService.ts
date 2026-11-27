import { supabase } from '../../integrations/supabase/client'
import type { WalletBalance, WalletCommission, WalletRecord, WalletSummary, WalletTransaction } from './walletDomain'

export type { WalletRecord } from './walletDomain'

export async function getWalletBalance(userId?: string): Promise<WalletBalance | null> {
  if (!userId) return null

  const { data, error } = await supabase
    .from('wallets')
    .select('available_balance, blocked_balance')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export const getWalletSummary = async (userId?: string): Promise<WalletSummary> => {
  if (!userId) return { wallet: null, transactions: [], commissions: [] }

  const { data: walletData, error: walletError } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (walletError) throw walletError

  const walletRecord: WalletRecord | null = walletData
  if (!walletRecord) return { wallet: null, transactions: [], commissions: [] }

  const { data: txData, error: transactionsError } = await supabase
    .from('transactions')
    .select('*')
    .eq('wallet_id', walletRecord.id)
    .order('created_at', { ascending: false })
    .limit(50)
  if (transactionsError) throw transactionsError

  const { data: commData, error: commissionsError } = await supabase
    .from('commissions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)
  if (commissionsError) throw commissionsError

  const transactions: WalletTransaction[] = txData || []
  const commissions: WalletCommission[] = commData || []

  return {
    wallet: walletRecord,
    transactions,
    commissions,
  }
}

export async function depositToWallet(userId: string, amount: number, description: string): Promise<void> {
  const { error } = await supabase.rpc('process_deposit', {
    p_user_id: userId,
    p_amount: amount,
    p_description: description,
  })

  if (error) throw error
}

export async function findWalletRecipientId(email: string): Promise<string> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single()

  if (error || !data) throw new Error('Usuário não encontrado')
  return data.id
}

export async function transferWalletBalance(
  fromUserId: string,
  toUserId: string,
  amount: number,
  description: string,
): Promise<void> {
  const { error } = await supabase.rpc('process_internal_transfer', {
    p_from_user_id: fromUserId,
    p_to_user_id: toUserId,
    p_amount: amount,
    p_description: description,
  })

  if (error) throw error
}
