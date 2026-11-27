import type { Database } from '../../integrations/supabase/types'

export type WalletRecord = Database['public']['Tables']['wallets']['Row']
export type WalletTransaction = Database['public']['Tables']['transactions']['Row']
export type WalletCommission = Database['public']['Tables']['commissions']['Row'] & {
  description?: string | null
}

export type WalletBalance = Pick<WalletRecord, 'available_balance' | 'blocked_balance'>

export interface WalletSummary {
  wallet: WalletRecord | null
  transactions: WalletTransaction[]
  commissions: WalletCommission[]
}

export function getWalletErrorMessage(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('message' in error)) return undefined
  return typeof error.message === 'string' ? error.message : undefined
}