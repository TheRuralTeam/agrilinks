    import { describe, it, expect, vi } from 'vitest'

const invoke = vi.fn()

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke } },
}))

import { buildAuthRedirectUrl, sendMagicLink, sendConfirmationEmail, sendPasswordResetEmail, sendSupportEmail } from './email'

describe('auth email helpers', () => {
  beforeEach(() => {
    invoke.mockClear()
  })

  it('builds a safe callback URL for the app route', () => {
    const url = buildAuthRedirectUrl('/app')
    expect(url).toContain('/auth/callback?next=')
    expect(url).toContain(encodeURIComponent('/app'))
  })

  it('encodes nested query params in the OAuth callback URL', () => {
    const url = buildAuthRedirectUrl('/app?tab=ofertas&order=recent')
    expect(url).toContain('/auth/callback?next=')
    expect(url).toContain(encodeURIComponent('/app?tab=ofertas&order=recent'))
    expect(url).not.toContain('next=/app?tab=ofertas')
  })

  it('sends the magic link through the shared edge function', async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null })

    const result = await sendMagicLink({
      email: 'teste@agrilink.ao',
      full_name: 'Teste User',
      next: '/app',
    })

    expect(invoke).toHaveBeenCalledWith('send-magic-link', expect.objectContaining({
      body: expect.objectContaining({
        email: 'teste@agrilink.ao',
        full_name: 'Teste User',
        redirect_to: expect.stringContaining('/auth/callback?next=%2Fapp'),
      }),
    }))
    expect(result).toEqual({ success: true })
  })

  it('sends the configured auth flow type so signup and recovery emails are generated correctly', async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null })

    await sendMagicLink({
      email: 'recuperar@agrilink.ao',
      next: '/reset-password',
      type: 'recovery',
    })

    expect(invoke).toHaveBeenCalledWith('send-magic-link', expect.objectContaining({
      body: expect.objectContaining({
        email: 'recuperar@agrilink.ao',
        redirect_to: expect.stringContaining('/auth/callback?next=%2Freset-password'),
        type: 'recovery',
      }),
    }))
  })

  it('routes account confirmation and password-reset through dedicated edge functions', async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null })

    await sendConfirmationEmail({ email: 'nova@agrilink.ao', full_name: 'Nova Pessoa' })
    await sendPasswordResetEmail({ email: 'reset@agrilink.ao' })
    await sendSupportEmail({
      name: 'João',
      email: 'suporte@agrilink.ao',
      phone: '923000000',
      message: 'Preciso de ajuda',
    })

    expect(invoke.mock.calls[0][0]).toBe('send-confirmation-email')
    expect(invoke.mock.calls[0][1]).toMatchObject({
      body: expect.objectContaining({
        email: 'nova@agrilink.ao',
        full_name: 'Nova Pessoa',
      }),
    })

    expect(invoke.mock.calls[1][0]).toBe('send-password-reset')
    expect(invoke.mock.calls[1][1]).toMatchObject({
      body: expect.objectContaining({
        email: 'reset@agrilink.ao',
      }),
    })

    expect(invoke.mock.calls[2][0]).toBe('send-support-email')
    expect(invoke.mock.calls[2][1]).toMatchObject({
      body: expect.objectContaining({
        name: 'João',
        email: 'suporte@agrilink.ao',
      }),
    })
  })

  it('rejects malformed emails before calling the edge function', async () => {
    invoke.mockClear()
    invoke.mockResolvedValue({ data: { success: true }, error: null })

    await expect(sendMagicLink({ email: 'email-invalido', next: '/app' })).rejects.toThrow(/Email inválido/i)
    expect(invoke).not.toHaveBeenCalled()
  })

  it('rejects unsafe redirect targets before calling the edge function', async () => {
    invoke.mockClear()
    invoke.mockResolvedValue({ data: { success: true }, error: null })

    await expect(sendPasswordResetEmail({ email: 'reset@agrilink.ao', next: 'https://evil.com/pwned' })).rejects.toThrow(/redirect|URL/i)
    expect(invoke).not.toHaveBeenCalled()
  })
})
