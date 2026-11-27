import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearGuestSession,
  ensureGuestSession,
  getGuestData,
  guestMinutesLeft,
  setGuestData,
} from '../guestSession'

describe('Guest session business rules', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    clearGuestSession()
    vi.restoreAllMocks()
  })

  it('cria uma sessão de visitante com perfil e dados padrão', () => {
    const session = ensureGuestSession()

    expect(session).toMatchObject({
      data: {
        profile: expect.objectContaining({
          is_guest: true,
          user_type: 'comprador',
          full_name: 'Visitante',
        }),
      },
    })
    expect(session.expiresAt).toBeGreaterThan(Date.now())
    expect(getGuestData('products', [])).toEqual([])
    expect(getGuestData('fichas', [])).toEqual([])
  })

  it('persiste e lê dados personalizados do convidado', () => {
    setGuestData('profile', { full_name: 'João Visitante', user_type: 'agricultor' })
    setGuestData('products', [{ id: 'p1', product_type: 'milho' }])

    expect(getGuestData('profile', {})).toMatchObject({
      full_name: 'João Visitante',
      user_type: 'agricultor',
    })
    expect(getGuestData('products', [])).toHaveLength(1)
  })

  it('não quebra quando o armazenamento está indisponível e mantém o countdown seguro', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    expect(() => ensureGuestSession()).not.toThrow()
    expect(guestMinutesLeft()).toBe(0)

    setItemSpy.mockRestore()
  })
})
