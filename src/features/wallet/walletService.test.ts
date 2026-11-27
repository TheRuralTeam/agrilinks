import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockSupabaseFrom, mockSupabaseRpc } = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
  mockSupabaseRpc: vi.fn(),
}))

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockSupabaseFrom,
    rpc: mockSupabaseRpc,
  },
}))

import {
  depositToWallet,
  findWalletRecipientId,
  getWalletBalance,
  getWalletSummary,
  transferWalletBalance,
} from './walletService'

describe('walletService', () => {
  beforeEach(() => {
    mockSupabaseFrom.mockReset()
    mockSupabaseRpc.mockReset()
  })

  it('returns an empty summary without querying when there is no user id', async () => {
    await expect(getWalletSummary()).resolves.toEqual({
      wallet: null,
      transactions: [],
      commissions: [],
    })
    expect(mockSupabaseFrom).not.toHaveBeenCalled()
  })

  it('reads the persisted wallet balance without loading a transaction sample', async () => {
    const persistedBalance = { available_balance: 1250, blocked_balance: 75 }
    mockSupabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: persistedBalance, error: null }) }),
      }),
    })

    await expect(getWalletBalance('user-1')).resolves.toEqual(persistedBalance)
    expect(mockSupabaseFrom).toHaveBeenCalledWith('wallets')
  })

  it('does not create a wallet or report a balance when no persisted row exists', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    })

    await expect(getWalletBalance('user-1')).resolves.toBeNull()
  })

  it('loads the wallet and its existing transaction and commission limits', async () => {
    const wallet = {
      id: 'wallet-1',
      user_id: 'user-1',
      available_balance: 0,
      blocked_balance: 15,
      total_earned: 0,
      total_spent: 0,
      total_withdrawn: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    }
    const transactions = [
      { id: 'deposit', wallet_id: 'wallet-1', type: 'deposit', status: 'completed', amount: 100 },
      { id: 'transfer', wallet_id: 'wallet-1', type: 'internal_transfer', status: 'completed', amount: 20 },
    ]
    const commissions = [{ id: 'commission-1', amount: 2 }]

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'wallets') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: wallet, error: null }) }),
          }),
        }
      }
      if (table === 'transactions') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ limit: async () => ({ data: transactions, error: null }) }),
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({
            order: () => ({ limit: async () => ({ data: commissions, error: null }) }),
          }),
        }),
      }
    })

    const result = await getWalletSummary('user-1')

    expect(result.wallet).toEqual(wallet)
    expect(result.transactions).toEqual(transactions)
    expect(result.commissions).toEqual(commissions)
    expect(mockSupabaseFrom).toHaveBeenNthCalledWith(1, 'wallets')
    expect(mockSupabaseFrom).toHaveBeenNthCalledWith(2, 'transactions')
    expect(mockSupabaseFrom).toHaveBeenNthCalledWith(3, 'commissions')
  })

  it('preserves the current deposit and transfer RPC contracts', async () => {
    mockSupabaseRpc.mockResolvedValue({ error: null })

    await depositToWallet('user-1', 100, 'Depósito via BAI Direto')
    await transferWalletBalance('user-1', 'user-2', 25, 'Transferência para user@example.ao')

    expect(mockSupabaseRpc).toHaveBeenNthCalledWith(1, 'process_deposit', {
      p_user_id: 'user-1',
      p_amount: 100,
      p_description: 'Depósito via BAI Direto',
    })
    expect(mockSupabaseRpc).toHaveBeenNthCalledWith(2, 'process_internal_transfer', {
      p_from_user_id: 'user-1',
      p_to_user_id: 'user-2',
      p_amount: 25,
      p_description: 'Transferência para user@example.ao',
    })
  })

  it('looks up a transfer recipient by email and preserves the missing-user error', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { id: 'user-2' }, error: null }) }),
      }),
    })

    await expect(findWalletRecipientId('user@example.ao')).resolves.toBe('user-2')
    expect(mockSupabaseFrom).toHaveBeenCalledWith('users')

    mockSupabaseFrom.mockReturnValue({
      select: () => ({
        eq: () => ({ single: async () => ({ data: null, error: { message: 'not found' } }) }),
      }),
    })

    await expect(findWalletRecipientId('missing@example.ao')).rejects.toThrow('Usuário não encontrado')
  })
})