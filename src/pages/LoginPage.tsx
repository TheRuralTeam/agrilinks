import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Mail, Lock, UserPlus, Eye, EyeOff, ArrowRight, Compass, X, Sprout, ShoppingCart, UserRound, PencilLine, Truck, CheckCircle2, ChevronLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { sendMagicLink, sendPasswordResetEmail } from '../features/auth/email'
import agrilinkLogo from '../assets/LogoAgriLinkOfficiallNoBackground.png'
// Imagem partilhada com o ecrã de Cadastro para manter a mesma identidade visual.
// Para trocar por vídeo: substituir o <img> do painel esquerdo por um <video autoPlay muted loop playsInline>.

import autenticar from '../assets/auth1.jpg'
import { toast } from '../hooks/use-toast'
import Loader from '../components/ui/Loader'

// ─── Design Tokens ────────────────────────────────────────────────────────────
import { T } from '../lib/brand';

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
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [phone, setPhone] = useState('')
  const [userType, setUserType] = useState<'agricultor' | 'agente' | 'comprador' | 'motorista'>('comprador')
  const [signupStep, setSignupStep] = useState<'profile' | 'details'>('profile')
  const [signupSuccess, setSignupSuccess] = useState(false)
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(true)
  const [signupLoading, setSignupLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)

  const { login, registerSimple, resendSignupConfirmation, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const requestedPath = (location.state as { from?: unknown } | null)?.from
  useEffect(() => {
    const mode = new URLSearchParams(location.search).get('mode')
    if (mode === 'signup') {
      setAuthMode('signup')
      setErrorMsg('')
    }
  }, [location.search])

  const redirectTo = typeof requestedPath === 'string'
    && requestedPath.startsWith('/')
    && !requestedPath.startsWith('//')
    ? requestedPath
    : '/app'

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    try { await signInWithGoogle(redirectTo) } finally { setGoogleLoading(false) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (authMode === 'signup') {
      if (!email || !phone || !password) {
        setErrorMsg('Preencha email, telefone e senha.')
        return
      }
      if (password.length < 8) {
        setErrorMsg('A palavra-passe deve ter pelo menos 8 caracteres.')
        return
      }
      setSignupLoading(true)
      try {
        const { error, data } = await registerSimple({ email, phone, password, user_type: userType })
        if (error) {
          setErrorMsg(error.message || 'Não foi possível criar a conta.')
          return
        }
        setConfirmationEmailSent(data?.confirmation_sent === true)
        setSignupSuccess(true)
      } finally {
        setSignupLoading(false)
      }
      return
    }

    if (!email) return
    setLoading(true)
    try {
      if (!password) {
        await sendMagicLink({ email, next: redirectTo })
        toast({ title: 'Código enviado', description: 'Verifique o seu email e clique no botão para entrar.' })
        return
      }
      const { error } = await login(email, password)
      if (error) {
        if (
          error.message.includes('email not confirmed') ||
          error.message.includes('User not confirmed') ||
          error.message.includes('Email not confirmed')
        ) {
          const { error: resendError } = await resendSignupConfirmation(email)
          if (resendError) throw resendError
          setErrorMsg('A sua conta ainda não foi confirmada. Enviámos um novo link de confirmação para o seu email.')
        } else {
          setErrorMsg('Credenciais inválidas. Verifique e tente novamente.')
        }
        return
      }
      navigate(redirectTo, { replace: true })
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

  const handleResendSignupConfirmation = async () => {
    if (!email.trim() || resendLoading) { if (!email.trim()) toast({ title: 'Atenção', description: 'Insira o email usado no cadastro.' }); return }
    setResendLoading(true)
    try {
      const { error } = await resendSignupConfirmation(email);
      if (error) throw error
      toast({ title: 'Confirmação enviada', description: 'Verifique a caixa de entrada e a pasta de spam.' })
    } catch (err: any) {
      toast({ title: 'Não foi possível enviar', description: err?.message || 'Tente novamente mais tarde.', variant: 'destructive' })
    } finally {
      setResendLoading(false)
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
              <Loader compact />
            </div>
          </div>
        )}

        <div className="w-full max-w-md relative z-10" style={{ animation: 'fadeUp 0.5s ease both' }}>

          {/* Logo, maior, sem legenda */}
          <div className="mb-10 flex justify-center lg:justify-start">
            <img
              src={agrilinkLogo}
              alt="AgriLink"
              style={{ height: 72, display: 'block', filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.08))' }}
            />
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h1 style={{ fontSize: 26, fontWeight: 800, color: T.ink, margin: 0, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
              {authMode === 'login' ? 'Bem-vindo de volta' : 'Criar conta AgriLink'}
            </h1>
            <p style={{ fontSize: 14, color: T.muted, margin: '8px 0 0', fontWeight: 500 }}>
              {authMode === 'login' ? 'Acede à tua conta para gerir os teus negócios.' : 'Preenche os teus dados e escolhe como pretendes utilizar a AgriLink.'}
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

          {signupSuccess ? (
            <div style={{ padding: 22, borderRadius: 18, background: T.g50, border: `1px solid ${T.gBorder}`, color: T.ink }}>
              <div style={{ width: 48, height: 48, borderRadius: 999, background: T.g600, color: T.white, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <Mail size={22} />
              </div>
              <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>Confirma o teu email</h2>
              <p style={{ margin: 0, fontSize: 14, color: T.muted, lineHeight: 1.6 }}>
                {confirmationEmailSent ? <>O cadastro só fica concluído depois de confirmares o email <strong>{email}</strong>. Abre o link recebido para activar a conta e, depois, inicia sessão. Verifica também a pasta de spam.</> : <>A conta foi criada, mas o email de confirmação ainda não foi enviado. Usa o botão abaixo para pedir um novo link para <strong>{email}</strong>.</>}
              </p>
              <button type="button" onClick={handleResendSignupConfirmation} disabled={resendLoading} style={{ marginTop: 18, width: '100%', height: 46, borderRadius: 999, border: `1px solid ${T.goldBorder}`, background: T.goldPale, color: T.ink, fontWeight: 700, opacity: resendLoading ? 0.6 : 1 }}>
                {resendLoading ? 'A enviar confirmação...' : 'Reenviar email de confirmação'}
              </button>
              <button type="button" onClick={() => { setSignupSuccess(false); setAuthMode('login'); }} style={{ marginTop: 10, width: '100%', height: 46, borderRadius: 999, border: `1px solid ${T.rule}`, background: T.white, color: T.ink, fontWeight: 700 }}>
                Voltar ao login
              </button>
            </div>
          ) : authMode === 'signup' && signupStep === 'profile' ? (
            <section aria-labelledby="signup-profile-title" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.g600 }}>Etapa 1 de 2 · Perfil de utilização</p>
                <h2 id="signup-profile-title" style={{ margin: '8px 0 6px', fontSize: 23, lineHeight: 1.25, fontWeight: 800, color: T.ink }}>Como pretende utilizar a AgriLink?</h2>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: T.muted }}>Selecione o perfil que corresponde à sua actividade. A escolha ajuda-nos a configurar a experiência mais adequada.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 10 }}>
                {([
                  { id: 'agricultor', title: 'Agricultor / Fornecedor', detail: 'Publicar produtos e gerir ofertas', Icon: Sprout },
                  { id: 'comprador', title: 'Comprador', detail: 'Encontrar produtos e fazer pedidos', Icon: ShoppingCart },
                  { id: 'agente', title: 'Agente AgriLink', detail: 'Apoiar fornecedores e operações', Icon: UserRound },
                  { id: 'motorista', title: 'Motorista', detail: 'Prestar serviços de transporte', Icon: Truck },
                ] as const).map(({ id, title, detail, Icon }) => {
                  const selected = userType === id;
                  return <button key={id} type="button" aria-pressed={selected} onClick={() => setUserType(id)} style={{ minHeight: 132, padding: 14, borderRadius: 15, border: `1px solid ${selected ? T.g600 : T.rule}`, background: selected ? T.g50 : T.white, textAlign: 'left', cursor: 'pointer', boxShadow: selected ? '0 0 0 2px rgba(48,111,58,0.10)' : 'none', transition: 'border-color 160ms ease, background 160ms ease' }}>
                    <span style={{ width: 36, height: 36, position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 11, background: selected ? T.g600 : '#F0F4F0', color: selected ? T.white : T.g600 }}><Icon size={18} strokeWidth={1.8} />{id === 'agente' && <PencilLine size={10} strokeWidth={2.2} style={{ position: 'absolute', right: -3, bottom: -3, padding: 1, borderRadius: 3, background: T.white, color: T.g600 }} aria-hidden="true" />}</span>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 12 }}><strong style={{ fontSize: 12, lineHeight: 1.4, color: T.ink }}>{title}</strong>{selected && <CheckCircle2 size={15} color={T.g600} style={{ flexShrink: 0 }} />}</span>
                    <span style={{ display: 'block', marginTop: 5, fontSize: 11, lineHeight: 1.5, color: T.muted }}>{detail}</span>
                  </button>
                })}
              </div>
              <button type="button" onClick={() => setSignupStep('details')} style={{ width: '100%', height: 48, borderRadius: 12, border: 'none', background: T.g600, color: T.white, fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
                Continuar como {userType === 'agricultor' ? 'Agricultor / Fornecedor' : userType === 'comprador' ? 'Comprador' : userType === 'agente' ? 'Agente AgriLink' : 'Motorista'} <ArrowRight size={16} />
              </button>
            </section>
          ) : (
          <form onSubmit={handleSubmit} className="field-group" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <FieldLabel>Email</FieldLabel>
              <div style={{ position: 'relative' }}>
                <Mail style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.muted, width: 17, height: 17, pointerEvents: 'none' }} />
                <input type="email" placeholder="exemplo@agrilink.ao" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} required />
              </div>
            </div>
            {authMode === 'signup' ? (
              <>
                <div style={{ padding: '12px 14px', borderRadius: 13, border: `1px solid ${T.gBorder}`, background: T.g50, marginBottom: 2 }}>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.muted }}>Etapa 2 de 2 · Dados da conta</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 5 }}>
                    <strong style={{ fontSize: 13, color: T.g600 }}>{userType === 'agricultor' ? 'Agricultor / Fornecedor' : userType === 'comprador' ? 'Comprador' : userType === 'agente' ? 'Agente AgriLink' : 'Motorista'}</strong>
                    <button type="button" onClick={() => setSignupStep('profile')} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: 0, border: 'none', background: 'none', color: T.g600, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}><ChevronLeft size={14} /> Alterar</button>
                  </div>
                </div>
                <div>
                  <FieldLabel>Telefone</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <input type="tel" placeholder="+244 9xx xxx xxx" value={phone} onChange={e => setPhone(e.target.value)} style={{ ...inputStyle, paddingLeft: 16 }} required />
                  </div>
                </div>
                <div>
                  <FieldLabel>Senha</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.muted, width: 17, height: 17, pointerEvents: 'none' }} />
                    <input type={showPassword ? 'text' : 'password'} placeholder="Mínimo de 8 caracteres" value={password} onChange={e => setPassword(e.target.value)} style={{ ...inputStyle, paddingRight: 48 }} minLength={8} required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      {showPassword ? <EyeOff style={{ color: T.muted, width: 17 }} /> : <Eye style={{ color: T.muted, width: 17 }} />}
                    </button>
                  </div>
                </div>


                <button type="submit" disabled={signupLoading} className="login-btn" style={{ width: '100%', height: 52, borderRadius: 999, border: 'none', background: signupLoading ? T.muted : T.g600, color: T.white, fontSize: 15, fontWeight: 700 }}>
                  {signupLoading ? 'A criar conta…' : 'Criar conta'}
                </button>
              </>
            ) : (
              <>
                <div>
                  <FieldLabel rightSlot={
                    <button type="button" className="link-btn" onClick={() => setShowForgotPassword(true)} style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.gold, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      Esqueceu-se?
                    </button>
                  }>Senha</FieldLabel>
                  <div style={{ position: 'relative' }}>
                    <Lock style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: T.muted, width: 17, height: 17, pointerEvents: 'none' }} />
                    <input type={showPassword ? 'text' : 'password'} placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} style={{ ...inputStyle, paddingRight: 48 }} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      {showPassword ? <EyeOff style={{ color: T.muted, width: 17 }} /> : <Eye style={{ color: T.muted, width: 17 }} />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="login-btn" style={{ width: '100%', height: 52, borderRadius: 16, border: 'none', background: loading ? T.muted : T.g600, color: T.white, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {loading ? 'A entrar...' : 'Entrar na Plataforma'}
                </button>
              </>
            )}
          </form>
          )}


          {authMode === 'login' && (<>
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

          </>) }
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

          {authMode === 'login' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.78fr) minmax(0, 1.22fr)', gap: 12, marginBottom: 16 }}>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                aria-label={googleLoading ? 'A conectar com Google' : 'Entrar com Google'}
                title="Entrar com Google"
                style={{
                  width: '100%', minWidth: 0, height: 50, borderRadius: 16,
                  border: `1px solid ${T.rule}`, backgroundColor: T.white,
                  cursor: googleLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: googleLoading ? 0.65 : 1,
                }}
              >
                <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.5-5.2l-6.2-5.2c-2 1.4-4.5 2.4-7.3 2.4-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.6 39.5 16.2 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2c-.4.4 6.7-4.9 6.7-14.8 0-1.2-.1-2.4-.4-3.5z"/>
                </svg>
              </button>
              <button
                type="button"
                className="register-btn"
                onClick={() => { setAuthMode('signup'); setSignupStep('profile'); setErrorMsg(''); setPassword(''); }}
                style={{
                  width: '100%', minWidth: 0, height: 50, borderRadius: 16,
                  border: `1px solid ${T.goldBorder}`, background: T.goldPale,
                  color: T.ink, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 7, padding: '0 10px', whiteSpace: 'nowrap',
                }}
              >
                <UserPlus style={{ color: T.gold, width: 17, height: 17, flexShrink: 0 }} />
                Criar conta
              </button>
            </div>
          ) : (
            <button className="register-btn" onClick={() => { setAuthMode('login'); setSignupSuccess(false); setErrorMsg(''); }} style={{ width:'100%', height:50, borderRadius:999, border:`1px solid ${T.rule}`, background:T.white, color:T.muted, fontSize:14, fontWeight:700, cursor:'pointer', marginBottom:16 }}>
              Já tenho uma conta
            </button>
          )}

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
