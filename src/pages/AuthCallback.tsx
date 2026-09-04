import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import orbisLinkLogo from '@/assets/orbislink-logo.png'
import { T, FONT } from '@/lib/brand'

type Phase = 'checking' | 'needs-click' | 'working' | 'error'

const AuthCallback = () => {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('checking')
  const [message, setMessage] = useState('A validar o acesso à AgriLink...')

  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.substring(1))
  const requestedNext = query.get('next') || '/app'
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/app'
  const tokenHash = query.get('token_hash') || query.get('token')
  const otpType = (query.get('type') || 'magiclink') as
    | 'magiclink'
    | 'signup'
    | 'email'
    | 'recovery'
    | 'invite'
    | 'email_change'

  const finish = async () => {
    const { data } = await supabase.auth.getSession()
    const userId = data.session?.user?.id
    if (!userId) {
      setPhase('error')
      setMessage('Não foi possível criar a sessão. Peça um novo link de confirmação.')
      return
    }
    const { error: syncError } = await supabase.rpc('sync_user_email_verified', { p_user_id: userId })
    if (syncError) console.warn('Não foi possível sincronizar o perfil:', syncError.message)
    navigate(next, { replace: true })
  }

  // Step 1: handle everything that does NOT consume a one-time token
  useEffect(() => {
    const run = async () => {
      const errorDescription = query.get('error_description') || hash.get('error_description')
      if (errorDescription) {
        setPhase('error')
        setMessage(decodeURIComponent(errorDescription))
        return
      }

      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')
      const code = query.get('code')

      try {
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) throw error
          await finish()
          return
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
          await finish()
          return
        }

        // Link with a hashed token: only exchange it on a REAL user click,
        // so email scanners (Gmail/Outlook pre-fetch) cannot burn the token.
        if (tokenHash) {
          setPhase('needs-click')
          setMessage('Confirme o seu email para entrar na plataforma.')
          return
        }

        // supabase-js may already have consumed the URL (detectSessionInUrl)
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          await finish()
          return
        }

        setPhase('error')
        setMessage('Link inválido ou já utilizado. Peça um novo link de confirmação.')
      } catch (error: any) {
        setPhase('error')
        setMessage(error?.message || 'Não foi possível concluir a autenticação.')
      }
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const confirmNow = async () => {
    if (!tokenHash) return
    setPhase('working')
    setMessage('A confirmar o seu email...')
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType })
    if (error) {
      setPhase('error')
      setMessage(
        error.message?.includes('expired')
          ? 'Este link expirou ou já foi utilizado. Peça um novo link de confirmação.'
          : error.message || 'Não foi possível confirmar o email.',
      )
      return
    }
    await finish()
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: T.canvas,
        padding: 24,
        fontFamily: FONT,
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 420,
          background: T.white,
          border: `1px solid ${T.rule}`,
          borderRadius: 20,
          padding: 32,
          textAlign: 'center',
          boxShadow: T.shadowLg,
        }}
      >
        <img src={orbisLinkLogo} alt="AgriLink" style={{ height: 64, margin: '0 auto 18px', display: 'block' }} />

        {(phase === 'checking' || phase === 'working') && (
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              border: `4px solid ${T.g100}`,
              borderTopColor: T.green,
              margin: '0 auto 18px',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        )}

        <h1 style={{ margin: 0, color: T.ink, fontSize: 20, fontWeight: 800 }}>Acesso AgriLink</h1>
        <p style={{ margin: '8px 0 0', color: T.muted, fontSize: 14, lineHeight: 1.6 }}>{message}</p>

        {phase === 'needs-click' && (
          <button
            onClick={confirmNow}
            style={{
              marginTop: 20,
              width: '100%',
              height: 48,
              borderRadius: 12,
              border: 'none',
              background: T.green,
              color: T.white,
              fontWeight: 700,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Confirmar o meu email
          </button>
        )}

        {phase === 'error' && (
          <button
            onClick={() => navigate('/confirmar-email', { replace: true })}
            style={{
              marginTop: 20,
              width: '100%',
              height: 48,
              borderRadius: 12,
              border: `1.5px solid ${T.gBorder}`,
              background: T.g50,
              color: T.green,
              fontWeight: 700,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Pedir novo link
          </button>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </section>
    </main>
  )
}

export default AuthCallback
