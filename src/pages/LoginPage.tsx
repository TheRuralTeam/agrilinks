import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, UserPlus, Eye, EyeOff, ArrowRight, Compass, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { buildAuthRedirectUrl, sendMagicLink, sendPasswordResetEmail } from '@/features/auth/email'
import orbisLinkLogo from '@/assets/orbislink-logo.png'
// Imagem partilhada com o ecrã de Cadastro para manter a mesma identidade visual.
// Para trocar por vídeo: substituir o <img> do painel esquerdo por um <video autoPlay muted loop playsInline>.

import autenticar from '@/assets/auth1.jpg'
import { toast } from '@/hooks/use-toast'

// ─── Design Tokens ────────────────────────────────────────────────────────────
import { T } from '@/lib/brand';

// ─── Input style (leve, com um toque dourado apenas no foco) ────────────────
const inputStyle: React.CSSProperties = {
  height: '50px',
  width: '100%',
  borderRadius: '14px',
  border: `1px solid ${T.rule}`,
  backgroundColor: T.white,
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
      fontSize: '10px', fontWeight: 800,
      letterSpacing: '0.1em', textTransform: 'uppercase', color: T.muted,
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
  const [googleLoading, setGoogleLoading] = useState(false)

  const { login, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    try { await signInWithGoogle() } finally { setGoogleLoading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setErrorMsg('')
    setLoading(true)
    try {
      const { error } = await login(email, password)
      if (error) {
        if (
          error.message.includes('email not confirmed') ||
          error.message.includes('User not confirmed') ||
          error.message.includes('Email not confirmed')
        ) {
          await sendMagicLink({ email, next: '/app' })
          setErrorMsg('A sua conta ainda não foi confirmada. Enviámos um novo link de confirmação para o seu email.')
        } else {
          setErrorMsg('Credenciais inválidas. Verifique e tente novamente.')
        }
        return
      }
      navigate('/app')
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) { toast({ title: 'Atenção', description: 'Insira o seu email primeiro.' }); return }
    setResetLoading(true)
    try {
      await sendPasswordResetEmail({ email, next: '/reset-password' })
      toast({ title: 'Email enviado', description: 'Verifique a sua caixa de entrada.' })
      setShowForgotPassword(false)
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setResetLoading(false)
    }
  }

  const handleResendConfirmation = async () => {
    if (!email) { toast({ title: 'Atenção', description: 'Insira o seu email primeiro.' }); return }
    setResendLoading(true)
    try {
      await sendMagicLink({ email, next: '/app' })
      toast({ title: 'Link enviado', description: 'Verifique a caixa de entrada (e o spam) do seu email.' })
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ backgroundColor: T.canvas, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        input:focus { border-color: ${T.g600} !important; box-shadow: 0 0 0 4px rgba(45,125,58,0.10) !important; }
        .field-group { animation: fadeUp 0.45s ease both; }
        .login-btn { transition: transform 0.18s ease, opacity 0.18s ease; }
        .login-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .login-btn:active:not(:disabled) { transform: scale(0.98); }
        .register-btn { transition: transform 0.18s ease, background-color 0.18s ease; }
        .register-btn:hover { transform: translateY(-1px); }
        .register-btn:active { transform: scale(0.98); }
        .guest-btn { transition: transform 0.18s ease, background-color 0.18s ease; }
        .guest-btn:hover { transform: translateY(-1px); }
        .link-btn { transition: opacity 0.15s; }
        .link-btn:hover { opacity: 0.65; }
      `}</style>

      {/* ── Painel esquerdo: imagem/vídeo da plataforma + mensagem conceitual ── */}
      <div className="relative lg:w-2/5 h-64 sm:h-80 lg:h-auto overflow-hidden">
        <img
          src={autenticar}
          alt="Rede AgriLink de produtores e compradores"
          className="w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(to bottom, rgba(26, 92, 36, 0.35), ${T.g900} 96%)` }}
        />
        <div className="absolute inset-0 flex flex-col justify-end p-8 lg:p-14">
          <div className="max-w-md animate-in fade-in slide-in-from-left-6 duration-700">
            <div className="h-1 w-10 mb-6 rounded-full" style={{ backgroundColor: T.goldL }} />
            <h2 className="text-3xl lg:text-4xl font-black mb-4 leading-tight text-white">
              Sempre ligado à tua rede
            </h2>
            <p className="text-sm lg:text-base font-medium text-white/85 leading-relaxed">
              Entra na tua conta e continua a negociar com fornecedores, agentes e compradores
              em toda Angola, sem sair do lugar.
            </p>
          </div>
        </div>
      </div>

      {/* ── Painel direito: formulário, leve, com dourado só como acento ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 lg:px-16 lg:py-16 relative overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-72 h-72 rounded-full blur-3xl opacity-[0.07] pointer-events-none" style={{ backgroundColor: T.g400 }} />

        {/* Loading overlay, discreto */}
        {loading && (
          <div style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 40, height: 40,
                border: `3px solid ${T.rule}`,
                borderTopColor: T.g600,
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <p style={{ fontWeight: 700, fontSize: 14, color: T.ink, margin: 0 }}>A autenticar…</p>
            </div>
          </div>
        )}

        <div className="w-full max-w-md relative z-10" style={{ animation: 'fadeUp 0.5s ease both' }}>

          {/* Logo, maior, sem legenda */}
          <div className="mb-10 flex justify-center lg:justify-start">
            <img
              src={orbisLinkLogo}
              alt="AgriLink"
              style={{ height: 104, display: 'block', filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.08))' }}
            />
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h1 style={{ fontSize: 26, fontWeight: 800, color: T.ink, margin: 0, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
              Bem-vindo de volta
            </h1>
            <p style={{ fontSize: 14, color: T.muted, margin: '8px 0 0', fontWeight: 500 }}>
              Acede à tua conta para gerir os teus negócios.
            </p>
          </div>

          {errorMsg && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 14,
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#B91C1C',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 10,
              marginBottom: 18,
            }}>
              <X style={{ width: 15, height: 15, flexShrink: 0 }} />
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="field-group" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Email */}
            <div>
              <FieldLabel>Email</FieldLabel>
              <div style={{ position: 'relative' }}>
                <Mail style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.muted, width: 17, height: 17, pointerEvents: 'none' }} />
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
                    style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.gold, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Esqueceu-se?
                  </button>
                }
              >
                Senha
              </FieldLabel>
              <div style={{ position: 'relative' }}>
                <Lock style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.muted, width: 17, height: 17, pointerEvents: 'none' }} />
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
                    ? <EyeOff style={{ color: T.muted, width: 17, height: 17 }} />
                    : <Eye style={{ color: T.muted, width: 17, height: 17 }} />}
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
                height: 52,
                borderRadius: 999,
                border: 'none',
                backgroundColor: loading ? T.muted : T.g600,
                color: T.white,
                fontSize: 15,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
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
                fontSize: 11, fontWeight: 700, color: T.muted,
                background: 'none', border: 'none', cursor: 'pointer',
                opacity: resendLoading || !email ? 0.4 : 1,
              }}
            >
              {resendLoading ? 'A enviar...' : 'Reenviar link de confirmação'}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center" style={{ margin: '22px 0' }}>
            <div style={{ flex: 1, height: 1, backgroundColor: T.rule }} />
            <span style={{
              padding: '0 12px', fontSize: 10, fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase', color: T.faint,
            }}>
              Ou
            </span>
            <div style={{ flex: 1, height: 1, backgroundColor: T.rule }} />
          </div>

          {/* Google Sign-in */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            style={{
              width: '100%', height: 50, borderRadius: 999,
              border: `1px solid ${T.rule}`, backgroundColor: T.white,
              color: T.ink, fontSize: 14, fontWeight: 700, cursor: googleLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              marginBottom: 14,
            }}
          >
            <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.3 2.4-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.6 39.5 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2c-.4.4 6.7-4.9 6.7-14.8 0-1.2-.1-2.4-.4-3.5z"/>
            </svg>
            {googleLoading ? 'A conectar...' : 'Continuar com Google'}
          </button>

          {/* Register */}
          <button
            className="register-btn"
            onClick={() => navigate('/cadastro')}
            style={{
              width: '100%',
              height: 50,
              borderRadius: 999,
              border: `1px solid ${T.goldBorder}`,
              backgroundColor: T.goldPale,
              color: T.ink,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginBottom: 16,
            }}
          >
            <UserPlus style={{ color: T.gold, width: 17, height: 17 }} />
            Criar Nova Conta
          </button>

          <button
            onClick={() => navigate('/app')}
            style={{
              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              color: T.muted, fontSize: 12.5, fontWeight: 700,
              textDecoration: 'underline', marginBottom: 16, padding: 0,
            }}
          >
            Explorar como convidado
          </button>

          {/* Cartão: entrar como visitante */}
          <Link
            to="/"
            className="guest-btn"
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px',
              borderRadius: 16,
              border: `1px dashed ${T.goldBorder}`,
              backgroundColor: 'rgba(201,146,42,0.06)',
              textDecoration: 'none',
              marginBottom: 20,
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 999, flexShrink: 0,
              backgroundColor: T.goldPale,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Compass style={{ color: T.gold, width: 17, height: 17 }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, margin: 0 }}>
                Prefere só olhar por agora?
              </p>
              <p style={{ fontSize: 11.5, color: T.muted, margin: '2px 0 0', fontWeight: 500 }}>
                Podes entrar como visitante e criar a tua conta mais tarde, sem problema.
              </p>
            </div>
            <ArrowRight style={{ color: T.gold, width: 16, height: 16, flexShrink: 0 }} />
          </Link>

          {/* Site link */}
          <div style={{ textAlign: 'center' }}>
            <Link
              to="/site"
              className="link-btn"
              style={{
                fontSize: 11, fontWeight: 700,
                color: T.g700,
                textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              Site Institucional
              <ArrowRight style={{ width: 12, height: 12 }} />
            </Link>
          </div>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.faint }}>
            © 2025 AgriLink Lda · Segurança Garantida
          </p>
        </div>
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
            border: `1px solid ${T.goldBorder}`,
            borderBottom: 'none',
            padding: '28px 28px 40px',
            animation: 'fadeUp 0.25s ease both',
          }}>
            {/* Handle bar */}
            <div style={{ width: 40, height: 4, borderRadius: 4, backgroundColor: T.goldBorder, margin: '0 auto 20px' }} />
            <h3 style={{ fontSize: 19, fontWeight: 800, color: T.ink, margin: '0 0 20px' }}>Recuperar senha</h3>
            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <FieldLabel>Email da conta</FieldLabel>
                <div style={{ position: 'relative' }}>
                  <Mail style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.muted, width: 17, height: 17, pointerEvents: 'none' }} />
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
                  width: '100%', height: 50, borderRadius: 999, border: 'none',
                  backgroundColor: T.g600,
                  color: T.white, fontSize: 15, fontWeight: 700,
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
                  width: '100%', height: 46, borderRadius: 999,
                  border: `1px solid ${T.rule}`,
                  backgroundColor: T.white, color: T.mid,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
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
