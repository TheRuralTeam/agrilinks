import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { angolaProvinces } from '@/data/angola-locations'
import agriLinkLogo from '@/assets/agrilink-logo.png'

/* â”€â”€â”€ Design tokens â”€â”€ */
const T = {
  g900: '#2c3d2e',
  g700: '#1A5C24',
  g600: '#2D7D3A',
  g500: '#3D9A48',
  g400: '#4CAF50',
  g100: '#E8F5E9',
  g50:  '#F2FAF3',
  gBorder: '#C8E6CA',
  ink:  '#111714',
  mid:  '#3D4D40',
  muted:'#758A79',
  faint:'#A8BAA9',
  canvas:'#F7F9F7',
  white:'#FFFFFF',
  rule: '#E5EDE6',
  red:  '#EF4444',
}

type AccountType = 'comprador' | 'agente' | 'agricultor'

interface StepState {
  accountType: AccountType | null
  phone: string
  province: string
  municipality: string
}

export default function ChooseAccountType() {
  const navigate = useNavigate()
  const { user, signInWithGoogle } = useAuth()

  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<StepState>({
    accountType: null,
    phone: '',
    province: '',
    municipality: '',
  })

  const provinces = angolaProvinces
  const municipalities = provinces.find(p => p.id === form.province)?.municipalities ?? []

  /* â”€â”€ Helpers â”€â”€ */
  const set = (key: keyof StepState, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  /* â”€â”€ Validate step 2 â”€â”€ */
  const validateStep2 = () => {
    if (!form.phone.trim()) { toast.error('Insira o seu nÃºmero de telefone.'); return false }
    if (!form.province) { toast.error('Seleccione a sua provÃ­ncia.'); return false }
    if (!form.municipality) { toast.error('Seleccione o seu municÃ­pio.'); return false }
    return true
  }

  /* â”€â”€ Step 1 â†’ 2 â”€â”€ */
  const handleSelectType = (type: AccountType) => {
    setForm(prev => ({ ...prev, accountType: type }))
    setStep(2)
  }

  /* â”€â”€ Continue with Google (pre-auth flow) â”€â”€ */
  const handleContinueWithGoogle = async () => {
    if (!validateStep2()) return
    setLoading(true)
    try {
      const { error } = await signInWithGoogle('signup', {
        user_type: form.accountType!,
        phone: form.phone,
        province_id: form.province,
        municipality_id: form.municipality,
      })
      if (error) {
        toast.error(error.message)
        setLoading(false)
      }
      // On success, browser redirects to Google OAuth â€“ no need to setLoading(false)
    } catch {
      toast.error('Erro ao iniciar autenticaÃ§Ã£o Google.')
      setLoading(false)
    }
  }

  /* â”€â”€ Post-auth profile creation (fallback when user already authed) â”€â”€ */
  const handleCompleteProfile = async () => {
    if (!user || !validateStep2()) return
    setLoading(true)
    try {
      const { error } = await supabase.from('users').upsert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Utilizador',
        identity_document: '',
        user_type: form.accountType!,
        province_id: form.province,
        municipality_id: form.municipality,
        phone: form.phone,
        email_verified: true,
        phone_verified: false,
      })
      if (error) throw error
      toast.success('Conta configurada com sucesso!')
      navigate('/app', { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao configurar conta.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  /* â”€â”€ Google icon SVG â”€â”€ */
  const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     RENDER
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  return (
    <div style={{
      minHeight: '100vh', background: T.canvas,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '24px 20px',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      {/* Logo */}
      <img src={agriLinkLogo} alt="AgriLink" style={{ height: 44, marginBottom: 32, objectFit: 'contain' }} />

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 440,
        background: T.white, borderRadius: 20,
        border: `1px solid ${T.rule}`,
        boxShadow: '0 4px 32px rgba(13,43,18,0.10)',
        overflow: 'hidden',
      }}>
        {/* Progress bar */}
        <div style={{ height: 4, background: T.g100 }}>
          <div style={{
            height: '100%',
            width: `${(step / 2) * 100}%`,
            background: T.g500,
            transition: 'width 0.4s ease',
          }} />
        </div>

        <div style={{ padding: '28px 28px 32px' }}>
          {/* Step indicator */}
          <p style={{ fontSize: 11, fontWeight: 700, color: T.faint, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 6px' }}>
            Passo {step} de 2
          </p>

          {/* â”€â”€â”€ STEP 1: Tipo de conta â”€â”€â”€ */}
          {step === 1 && (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: T.ink, margin: '0 0 6px' }}>
                Que tipo de conta?
              </h1>
              <p style={{ fontSize: 13, color: T.muted, margin: '0 0 24px', lineHeight: 1.6 }}>
                Escolha o perfil que melhor descreve a sua actividade.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {([
                  { type: 'comprador' as AccountType, label: 'Comprador', desc: 'Quero comprar produtos agrÃ­colas' },
                  { type: 'agente' as AccountType,    label: 'Agente Comercial', desc: 'FaÃ§o intermediaÃ§Ã£o entre produtores e compradores' },
                  { type: 'agricultor' as AccountType, label: 'Agricultor / Fornecedor', desc: 'Vendo os meus prÃ³prios produtos' },
                ] as const).map(({ type, label, desc }) => (
                  <button
                    key={type}
                    onClick={() => handleSelectType(type)}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '14px 16px', borderRadius: 12,
                      border: `1.5px solid ${T.gBorder}`,
                      background: T.g50, cursor: 'pointer',
                      transition: 'all 0.18s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = T.g500
                      ;(e.currentTarget as HTMLElement).style.background = T.g100
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = T.gBorder
                      ;(e.currentTarget as HTMLElement).style.background = T.g50
                    }}
                  >
                    <p style={{ fontWeight: 700, fontSize: 14, color: T.ink, margin: 0 }}>{label}</p>
                    <p style={{ fontSize: 12, color: T.muted, margin: '3px 0 0' }}>{desc}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* â”€â”€â”€ STEP 2: Telefone + LocalizaÃ§Ã£o â”€â”€â”€ */}
          {step === 2 && (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: T.ink, margin: '0 0 6px' }}>
                Contacto e localizaÃ§Ã£o
              </h1>
              <p style={{ fontSize: 13, color: T.muted, margin: '0 0 24px', lineHeight: 1.6 }}>
                Estes dados sÃ£o usados para conectar com compradores e fornecedores.
              </p>
              <div style={{
                background: '#F2FAF3',
                border: `1px solid ${T.gBorder}`,
                borderRadius: 10,
                padding: '10px 12px',
                marginBottom: 14,
              }}>
                <p style={{ margin: 0, fontSize: 12, color: T.mid, lineHeight: 1.5 }}>
                  ApÃ³s autenticar com Google, vamos pedir para definir uma palavra-passe para o seu e-mail.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.mid, display: 'block', marginBottom: 6 }}>
                    Telefone
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    placeholder="+244 9XX XXX XXX"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.mid, display: 'block', marginBottom: 6 }}>
                    ProvÃ­ncia
                  </label>
                  <select
                    value={form.province}
                    onChange={e => { set('province', e.target.value); set('municipality', '') }}
                    style={inputStyle}
                  >
                    <option value="">Seleccione...</option>
                    {provinces.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.mid, display: 'block', marginBottom: 6 }}>
                    MunicÃ­pio
                  </label>
                  <select
                    value={form.municipality}
                    onChange={e => set('municipality', e.target.value)}
                    disabled={!form.province}
                    style={{ ...inputStyle, opacity: form.province ? 1 : 0.5 }}
                  >
                    <option value="">Seleccione...</option>
                    {municipalities.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button onClick={() => setStep(1)} style={btnSecondary} disabled={loading}>
                  Voltar
                </button>
                {user ? (
                  /* Post-auth fallback: user already logged in, just create the profile */
                  <button
                    onClick={handleCompleteProfile}
                    style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }}
                    disabled={loading}
                  >
                    {loading ? 'A guardar...' : 'Concluir'}
                  </button>
                ) : (
                  /* Pre-auth: save onboarding data then redirect to Google OAuth */
                  <button
                    onClick={handleContinueWithGoogle}
                    style={{
                      ...btnPrimary,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      opacity: loading ? 0.7 : 1,
                    }}
                    disabled={loading}
                  >
                    {loading ? (
                      'A redirecionar...'
                    ) : (
                      <>
                        <GoogleIcon />
                        Continuar com Google
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <p style={{ fontSize: 12, color: T.faint, marginTop: 20 }}>
        AgriLink Â· Mercado AgrÃ­cola Digital
      </p>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1.5px solid #E5EDE6',
  fontSize: 13,
  fontFamily: "'DM Sans', system-ui, sans-serif",
  background: '#F7F9F7',
  color: '#111714',
  outline: 'none',
  boxSizing: 'border-box',
}

const btnPrimary: React.CSSProperties = {
  flex: 1,
  padding: '11px 0',
  borderRadius: 10,
  background: '#2D7D3A',
  border: 'none',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
  color: '#fff',
  transition: 'background 0.18s',
}

const btnSecondary: React.CSSProperties = {
  flex: 1,
  padding: '11px 0',
  borderRadius: 10,
  background: '#F2FAF3',
  border: '1.5px solid #C8E6CA',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  color: '#3D4D40',
  transition: 'background 0.18s',
}
