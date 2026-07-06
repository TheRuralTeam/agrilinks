import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import orbisLinkLogo from '@/assets/orbislink-logo.png'

const AuthCallback = () => {
  const navigate = useNavigate()
  const [message, setMessage] = useState('A validar o acesso à AgriLink...')

  useEffect(() => {
    const completeAuth = async () => {
      const query = new URLSearchParams(window.location.search)
      const hash = new URLSearchParams(window.location.hash.substring(1))
      const next = query.get('next') || '/app'

      try {
        const accessToken = hash.get('access_token')
        const refreshToken = hash.get('refresh_token')
        const code = query.get('code')

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) throw error
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)
          if (error) throw error
        }

        const { data } = await supabase.auth.getSession()
        const userId = data.session?.user?.id

        if (!userId) {
          navigate('/login', { replace: true })
          return
        }

        await supabase.rpc('sync_user_email_verified', { p_user_id: userId })
        navigate(next, { replace: true })
      } catch (error: any) {
        setMessage(error?.message || 'Não foi possível concluir a autenticação.')
      }
    }

    completeAuth()
  }, [navigate])

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F8F5EF', padding: 24 }}>
      <section style={{ width: '100%', maxWidth: 420, background: '#FFFFFF', border: '1px solid #C9A96E', borderRadius: 24, padding: 32, textAlign: 'center', boxShadow: '0 8px 40px rgba(160,114,42,0.16)' }}>
        <img src={orbisLinkLogo} alt="AgriLink" style={{ height: 70, margin: '0 auto 18px', display: 'block' }} />
        <div style={{ width: 54, height: 54, borderRadius: '50%', border: '4px solid #FBF3E4', borderTopColor: '#7CB342', margin: '0 auto 18px', animation: 'spin 0.8s linear infinite' }} />
        <h1 style={{ margin: 0, color: '#111714', fontSize: 22, fontWeight: 900 }}>Acesso AgriLink</h1>
        <p style={{ margin: '8px 0 0', color: '#758A79', fontSize: 14 }}>{message}</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </section>
    </main>
  )
}

export default AuthCallback