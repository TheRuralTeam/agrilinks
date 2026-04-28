import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { angolaProvinces } from '@/data/angola-locations'
import agriLinkLogo from '@/assets/agrilink-logo.png'

/* ─── Design tokens ── */
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
  password: string
  confirmPassword: string
  phone: string
  province: string
  municipality: string
}

export default function ChooseAccountType() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<StepState>({
    accountType: null,
    password: '',
    confirmPassword: '',
    phone: '',
    province: '',
    municipality: '',
  })

  const provinces = angolaProvinces
  const municipalities = provinces.find(p => p.id === form.province)?.municipalities ?? []

  /* ── Helpers ── */
  const set = (key: keyof StepState, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  /* ── Step 1 → 2 ── */
  const handleSelectType = (type: AccountType) => {
    setForm(prev => ({ ...prev, accountType: type }))
    setStep(2)
  }

  /* ── Step 2 → 3 ── */
  const handlePasswordNext = () => {
    if (form.password.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (form.password !== form.confirmPassword) {
      toast.error('As senhas não coincidem.')
      return
    }
    setStep(3)
  }

  /* ── Step 3 → Submit ── */
  const handleSubmit = async () => {
    if (!user) return
    if (!form.phone.trim()) {
      toast.error('Insira o seu número de telefone.')
      return
    }
    if (!form.province) {
      toast.error('Seleccione a sua província.')
      return
    }
    if (!form.municipality) {
      toast.error('Seleccione o seu município.')
      return
    }

    setLoading(true)
    try {
      // 1. Actualizar senha no Supabase Auth
      const { error: pwError } = await supabase.auth.updateUser({
        password: form.password,
      })
      if (pwError) throw pwError

      // 2. Criar perfil na tabela public.users
      // "agente" e "agricultor" mapeiam directamente; "comprador" também
      const dbUserType = form.accountType! // já é 'agricultor' | 'agente' | 'comprador'

      const { error: profileError } = await supabase.from('users').upsert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'Utilizador',
        identity_document: '',
        user_type: dbUserType,
        province_id: form.province,
        municipality_id: form.municipality,
        phone: form.phone,
        email_verified: true,
        phone_verified: false,
      })
      if (profileError) throw profileError

      toast.success('Conta configurada com sucesso!')
      navigate('/app', { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao configurar conta.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  /* ══════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════ */
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
            width: `${(step / 3) * 100}%`,
            background: T.g500,
            transition: 'width 0.4s ease',
          }} />
        </div>

        <div style={{ padding: '28px 28px 32px' }}>
          {/* Step indicator */}
          <p style={{ fontSize: 11, fontWeight: 700, color: T.faint, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 6px' }}>
            Passo {step} de 3
          </p>

          {/* ─── STEP 1: Tipo de conta ─── */}
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
                  { type: 'comprador' as AccountType, label: 'Comprador', desc: 'Quero comprar produtos agrícolas' },
                  { type: 'agente' as AccountType,    label: 'Agente Comercial', desc: 'Faço intermediação entre produtores e compradores' },
                  { type: 'agricultor' as AccountType, label: 'Agricultor / Fornecedor', desc: 'Vendo os meus próprios produtos' },
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

          {/* ─── STEP 2: Senha ─── */}
          {step === 2 && (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: T.ink, margin: '0 0 6px' }}>
                Crie uma senha
              </h1>
              <p style={{ fontSize: 13, color: T.muted, margin: '0 0 24px', lineHeight: 1.6 }}>
                Usará esta senha para entrar com o email também.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.mid, display: 'block', marginBottom: 6 }}>
                    Senha (mínimo 8 caracteres)
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    placeholder="••••••••"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: T.mid, display: 'block', marginBottom: 6 }}>
                    Confirmar senha
                  </label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={e => set('confirmPassword', e.target.value)}
                    placeholder="••••••••"
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button onClick={() => setStep(1)} style={btnSecondary}>Voltar</button>
                <button onClick={handlePasswordNext} style={btnPrimary}>Continuar</button>
              </div>
            </>
          )}

          {/* ─── STEP 3: Telefone + Localização ─── */}
          {step === 3 && (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: T.ink, margin: '0 0 6px' }}>
                Contacto e localização
              </h1>
              <p style={{ fontSize: 13, color: T.muted, margin: '0 0 24px', lineHeight: 1.6 }}>
                Estes dados são usados para conectar com compradores e fornecedores.
              </p>
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
                    Província
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
                    Município
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
                <button onClick={() => setStep(2)} style={btnSecondary} disabled={loading}>Voltar</button>
                <button onClick={handleSubmit} style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }} disabled={loading}>
                  {loading ? 'A guardar...' : 'Concluir'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <p style={{ fontSize: 12, color: T.faint, marginTop: 20 }}>
        AgriLink · Mercado Agrícola Digital
      </p>
    </div>
  )
}

/* ─── Shared styles ── */
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  borderRadius: 10, border: '1.5px solid #E5EDE6',
  fontSize: 13, fontFamily: "'DM Sans', system-ui, sans-serif",
  background: '#F7F9F7', color: '#111714',
  outline: 'none', boxSizing: 'border-box',
}

const btnPrimary: React.CSSProperties = {
  flex: 1, padding: '11px 0', borderRadius: 10,
  background: '#2D7D3A', border: 'none', cursor: 'pointer',
  fontSize: 13, fontWeight: 700, color: '#fff',
  transition: 'background 0.18s',
}

const btnSecondary: React.CSSProperties = {
  flex: 1, padding: '11px 0', borderRadius: 10,
  background: '#F2FAF3', border: '1.5px solid #C8E6CA',
  cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#3D4D40',
  transition: 'background 0.18s',
}
