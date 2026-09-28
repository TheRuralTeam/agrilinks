import { describe, expect, it } from 'vitest'
import { getWalletErrorMessage } from './walletDomain'

describe('getWalletErrorMessage', () => {
  it('returns an error message when present', () => {
    expect(getWalletErrorMessage(new Error('falha ao carregar'))).toBe('falha ao carregar')
  })

  it('returns undefined for an unknown error shape', () => {
    expect(getWalletErrorMessage('falha')).toBeUndefined()
  })
})