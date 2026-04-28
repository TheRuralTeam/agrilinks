import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, UserPlus, Eye, EyeOff, ArrowRight, ShieldCheck, X, Chrome } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import orbisLinkLogo from '@/assets/orbislink-logo.png'
import { toast } from '@/hooks/use-toast'

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message
  }

  return 'Erro inesperado.'
}

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  // Greens
  g700: '#1A5C24',
  g600: '#2D7D3A',
  g500: '#3D9A48',
  g50:  '#F2FAF3',
  gBorder: '#C8E6CA',

  // Gold / Earth
  gold:        '#A0722A',
  goldMid:     '#C9922A',
  goldDark:    '#7A5520',
  goldLight:   '#C9A96E',
  goldBg:      '#FDF8F0',
  goldPale:    '#FBF3E4',
  goldBorder:  '#C9A96E',

  // Neutrals
  ink:    '#111714',
  mid:    '#3D4D40',
  muted:  '#758A79',
  faint:  '#A8BAA9',
  canvas: '#F8F5EF',
  white:  '#FFFFFF',
  rule:   '#E8E0D0',

  // Shadows
  shadowLg: '0 8px 40px rgba(160,114,42,0.16)',
}

// ─── Input style ──────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  height: '52px',
  width: '100%',
  borderRadius: '14px',
  border: `1.5px solid ${T.goldBorder}`,
  backgroundColor: T.goldBg,
  color: T.ink,
  fontSize: '15px',
  paddingLeft: '44px',
  paddingRight: '16px',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 0.2s, box-shadow 0.2s',
}

const FieldLabel = ({ children, rightSlot }: { children: React.ReactNode; rightSlot?: React.ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
    <label style={{
      fontSize: '10px', fontWeight: 900,
      letterSpacing: '0.14em', textTransform: 'uppercase', color: T.mid,
      marginLeft: 2,
    }}>
      {children}
    </label>
    {rightSlot}
  </div>
)

// ─── Component ────────────────────────────────────────────────────────────────
const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const { login, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setErrorMsg('')
    setLoading(true)
    try {
      const { error } = await login(email, password)
      if (error) {
        const requiresEmailConfirmation = Boolean(error.needsEmailConfirmation)
        if (
          requiresEmailConfirmation ||
          error.message.includes('email not confirmed') ||
          error.message.includes('User not confirmed') ||
          error.message.includes('Email not confirmed')
        ) {
          try {
            const { error: resendError } = await supabase.auth.resend({
              type: 'signup',
              email,
              options: {
                emailRedirectTo: `${window.location.origin}/confirmar-email`,
              },
            })

            if (resendError) throw resendError

            toast({
              title: 'Confirmação necessária',
              description: 'Enviamos um novo link de confirmação para o seu e-mail.',
            })
            setErrorMsg('Conta ainda não confirmada. Verifique o seu e-mail e clique no link de confirmação.')
          } catch (error) {
            setErrorMsg(getErrorMessage(error) || 'Conta não confirmada. Não foi possível reenviar o link agora.')
          }
        } else {
          setErrorMsg(error.message || 'Credenciais inválidas. Verifique e tente novamente.')
        }
        return
      }
      navigate('/app')
    } catch (error) {
      setErrorMsg(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) { toast({ title: 'Atenção', description: 'Insira o seu email primeiro.' }); return }
    setResetLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      toast({ title: 'Email enviado', description: 'Verifique a sua caixa de entrada.' })
      setShowForgotPassword(false)
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' })
    } finally {
      setResetLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    if (!email) { toast({ title: 'Atenção', description: 'Insira o seu email primeiro.' }); return }
    setResendLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/confirmar-email`,
        },
      })
      if (error) throw error
      toast({ title: 'Email reenviado', description: 'Verifique a sua caixa de entrada ou spam.' })
    } catch (error) {
      toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' })
    } finally {
      setResendLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setErrorMsg('')
    setGoogleLoading(true)

    try {
      const { error } = await signInWithGoogle('login')
      if (error) {
        setErrorMsg(error.message || 'Não foi possível iniciar login com Google.')
      }
    } catch (error) {
      setErrorMsg(getErrorMessage(error))
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: T.canvas,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      {/* Decorative blobs */}
      <div style={{
        position: 'absolute', top: '-10%', right: '-10%',
        width: 400, height: 400, borderRadius: '50%',
        filter: 'blur(80px)', opacity: 0.18,
        background: 'radial-gradient(circle, #C8E6CA, transparent)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-8%', left: '-8%',
        width: 480, height: 480, borderRadius: '50%',
        filter: 'blur(80px)', opacity: 0.12,
        background: 'radial-gradient(circle, #C9A96E, transparent)',
        pointerEvents: 'none',
      }} />

      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(255,255,255,0.65)',
          backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            backgroundColor: T.white,
            padding: '40px 48px',
            borderRadius: 28,
            boxShadow: T.shadowLg,
            border: `1.5px solid ${T.goldBorder}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
          }}>
            <div style={{ position: 'relative', width: 64, height: 64 }}>
              <div style={{
                width: 64, height: 64,
                border: `4px solid ${T.goldPale}`,
                borderTopColor: T.goldMid,
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <ShieldCheck style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                color: T.goldMid, width: 24, height: 24,
              }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontWeight: 900, fontSize: 20, color: T.ink, margin: 0 }}>A Autenticar</p>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.muted, margin: '4px 0 0' }}>
                Aguarde um instante
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        input:focus {
          border-color: ${T.goldMid} !important;
          box-shadow: 0 0 0 3px rgba(201,146,42,0.15) !important;
        }
        .login-card { animation: fadeUp 0.55s ease both; }
        .login-btn { transition: all 0.18s ease; }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(45,125,58,0.30) !important;
        }
        .login-btn:active:not(:disabled) { transform: scale(0.98); }
        .register-btn { transition: all 0.18s ease; }
        .register-btn:hover { opacity: 0.8; transform: translateY(-1px); }
        .register-btn:active { transform: scale(0.98); }
        .link-btn { transition: opacity 0.15s; }
        .link-btn:hover { opacity: 0.65; }
      `}</style>

      <div className="login-card" style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 10 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src={orbisLinkLogo}
            alt="AgriLink"
            style={{ height: 80, margin: '0 auto 14px', display: 'block', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.08))' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ height: 1, width: 32, backgroundColor: T.goldBorder }} />
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.22em', textTransform: 'uppercase', color: T.gold }}>
              AgriLink Platform
            </span>
            <div style={{ height: 1, width: 32, backgroundColor: T.goldBorder }} />
          </div>
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: T.white,
          borderRadius: 28,
          border: `1.5px solid ${T.goldBorder}`,
          boxShadow: T.shadowLg,
          overflow: 'hidden',
        }}>
          {/* Header gradient band */}
          <div style={{
            padding: '28px 32px 22px',
            background: `linear-gradient(135deg, ${T.goldPale} 0%, ${T.white} 70%)`,
            borderBottom: `1px solid ${T.rule}`,
            textAlign: 'center',
          }}>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: T.ink, margin: 0, lineHeight: 1.2 }}>
              Bem-vindo de volta
            </h1>
            <p style={{ fontSize: 13, color: T.muted, margin: '6px 0 0', fontWeight: 500 }}>
              Aceda à sua conta para gerir os seus negócios
            </p>
          </div>

          {/* Form */}
          <div style={{ padding: '28px 32px 32px' }}>

            {errorMsg && (
              <div style={{
                padding: '12px 16px',
                borderRadius: 12,
                backgroundColor: '#FEF2F2',
                border: '1.5px solid #FECACA',
                color: '#B91C1C',
                fontSize: 14,
                fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 10,
                marginBottom: 20,
              }}>
                <X style={{ width: 16, height: 16, flexShrink: 0 }} />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Email */}
              <div>
                <FieldLabel>Email</FieldLabel>
                <div style={{ position: 'relative' }}>
                  <Mail style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.goldLight, width: 18, height: 18, pointerEvents: 'none' }} />
                  <input
                    type="email"
                    placeholder="exemplo@agrilink.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <FieldLabel
                  rightSlot={
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => setShowForgotPassword(true)}
                      style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.gold, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Esqueceu-se?
                    </button>
                  }
                >
                  Senha
                </FieldLabel>
                <div style={{ position: 'relative' }}>
                  <Lock style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.goldLight, width: 18, height: 18, pointerEvents: 'none' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ ...inputStyle, paddingRight: '48px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {showPassword
                      ? <EyeOff style={{ color: T.goldLight, width: 18, height: 18 }} />
                      : <Eye style={{ color: T.goldLight, width: 18, height: 18 }} />}
                  </button>
                </div>
              </div>

              {/* Login button */}
              <button
                type="submit"
                disabled={loading}
                className="login-btn"
                style={{
                  width: '100%',
                  height: 54,
                  borderRadius: 16,
                  border: 'none',
                  background: loading ? T.muted : `linear-gradient(135deg, ${T.g600} 0%, ${T.g500} 100%)`,
                  color: T.white,
                  fontSize: 16,
                  fontWeight: 900,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(45,125,58,0.25)',
                  letterSpacing: '0.02em',
                  marginTop: 4,
                }}
              >
                Entrar na Plataforma
                <ArrowRight style={{ width: 18, height: 18 }} />
              </button>
            </form>

            {/* Resend confirmation */}
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button
                type="button"
                className="link-btn"
                onClick={handleResendConfirmation}
                disabled={resendLoading || !email}
                style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: T.muted,
                  background: 'none', border: 'none', cursor: 'pointer',
                  opacity: resendLoading || !email ? 0.4 : 1,
                }}
              >
                {resendLoading ? 'A reenviar...' : 'Reenviar confirmação de email'}
              </button>
            </div>

            {/* Divider */}
            <div style={{ position: 'relative', margin: '22px 0', display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, height: 1, backgroundColor: T.rule }} />
              <span style={{
                padding: '0 14px', fontSize: 10, fontWeight: 900,
                letterSpacing: '0.18em', textTransform: 'uppercase', color: T.faint,
                backgroundColor: T.white,
              }}>
                Ou
              </span>
              <div style={{ flex: 1, height: 1, backgroundColor: T.rule }} />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
              style={{
                width: '100%',
                height: 50,
                borderRadius: 16,
                border: `1.5px solid ${T.rule}`,
                backgroundColor: T.white,
                color: T.ink,
                fontSize: 14,
                fontWeight: 800,
                cursor: googleLoading || loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: googleLoading || loading ? 0.6 : 1,
              }}
            >
              <Chrome style={{ width: 18, height: 18 }} />
              {googleLoading ? 'A redirecionar...' : 'Entrar com Google'}
            </button>

            {/* Register */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ textAlign: 'center', fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.muted, margin: 0 }}>
                Ainda não tem conta?
              </p>
              <button
                className="register-btn"
                onClick={() => navigate('/cadastro')}
                style={{
                  width: '100%',
                  height: 50,
                  borderRadius: 16,
                  border: `1.5px solid ${T.goldBorder}`,
                  backgroundColor: T.goldPale,
                  color: T.ink,
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <UserPlus style={{ color: T.gold, width: 18, height: 18 }} />
                Criar Nova Conta
              </button>
            </div>

            {/* Site link */}
            <div style={{ textAlign: 'center', marginTop: 18 }}>
              <Link
                to="/site"
                className="link-btn"
                style={{
                  fontSize: 10, fontWeight: 900, letterSpacing: '0.14em',
                  textTransform: 'uppercase', color: T.g700,
                  textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                Site Institucional
                <ArrowRight style={{ width: 12, height: 12 }} />
              </Link>
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.faint }}>
          © 2025 AgriLink Lda · Segurança Garantida
        </p>
      </div>

      {/* Forgot password bottom sheet */}
      {showForgotPassword && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowForgotPassword(false) }}
        >
          <div style={{
            width: '100%', maxWidth: 480,
            backgroundColor: T.white,
            borderRadius: '28px 28px 0 0',
            border: `1.5px solid ${T.goldBorder}`,
            borderBottom: 'none',
            padding: '28px 28px 40px',
            animation: 'fadeUp 0.25s ease both',
          }}>
            {/* Handle bar */}
            <div style={{ width: 40, height: 4, borderRadius: 4, backgroundColor: T.goldBorder, margin: '0 auto 20px' }} />
            <h3 style={{ fontSize: 20, fontWeight: 900, color: T.ink, margin: '0 0 20px' }}>Recuperar senha</h3>
            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <FieldLabel>Email da conta</FieldLabel>
                <div style={{ position: 'relative' }}>
                  <Mail style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.goldLight, width: 18, height: 18, pointerEvents: 'none' }} />
                  <input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={resetLoading}
                style={{
                  width: '100%', height: 52, borderRadius: 16, border: 'none',
                  background: `linear-gradient(135deg, ${T.g600} 0%, ${T.g500} 100%)`,
                  color: T.white, fontSize: 15, fontWeight: 900,
                  cursor: resetLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: resetLoading ? 0.7 : 1,
                }}
              >
                {resetLoading ? 'A enviar...' : 'Enviar Link de Recuperação'}
              </button>
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                style={{
                  width: '100%', height: 48, borderRadius: 16,
                  border: `1.5px solid ${T.goldBorder}`,
                  backgroundColor: T.goldPale, color: T.mid,
                  fontSize: 14, fontWeight: 800, cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

export default LoginPage