import { supabase } from '@/integrations/supabase/client'

export interface WalletRecord {
  id: string
  user_id: string
  blocked_balance?: number | null
  [key: string]: any
}

export const getWalletSummary = async (userId?: string) => {
  if (!userId) return { wallet: null, transactions: [], commissions: [] }

  const { data: walletData, error: walletError } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (walletError) throw walletError

  let walletRecord = walletData as WalletRecord | null

  if (!walletRecord) {
    const { data: newWallet, error: createError } = await supabase
      .from('wallets')
      .insert({ user_id: userId })
      .select()
      .single()

    if (createError) throw createError
    walletRecord = newWallet as WalletRecord
  }

  const { data: txData } = await supabase
    .from('transactions')
    .select('*')
    .eq('wallet_id', walletRecord.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: commData } = await supabase
    .from('commissions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  const totalEarned =
    txData?.filter((tx) => tx.type === 'deposit' && tx.status === 'completed')
      .reduce((sum, tx) => sum + Number(tx.amount), 0) || 0

  const totalSpent =
    txData?.filter((tx) => tx.type === 'internal_transfer' && tx.status === 'completed')
      .reduce((sum, tx) => sum + Number(tx.amount), 0) || 0

  return {
    wallet: {
      ...walletRecord,
      total_earned: totalEarned,
      total_spent: totalSpent,
      available_balance: totalEarned - totalSpent,
      blocked_balance: walletRecord.blocked_balance || 0,
    },
    transactions: txData || [],
    commissions: commData || [],
  }
}
