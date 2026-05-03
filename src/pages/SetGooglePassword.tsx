import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'

const inputStyle: CSSProperties = {
  width: '100%',
  height: 48,
  borderRadius: 12,
  border: '1px solid #d8dfd9',
  padding: '0 44px 0 42px',
  fontSize: 14,
  outline: 'none',
  backgroundColor: '#ffffff',
}

const getPasswordValidationError = (password: string, confirmPassword: string) => {
  if (password.length < 6) {
    return 'A palavra-passe deve ter no mínimo 6 caracteres.'
  }

  if (password !== confirmPassword) {
    return 'As palavras-passe não coincidem.'
  }

  return null
}

export default function SetGooglePassword() {
  const navigate = useNavigate()
  const { user, loading, setGooglePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [saving, setSaving] = useState(false)

  const isGoogleUser = useMemo(() => user?.app_metadata?.provider === 'google', [user])
  const hasGooglePassword = useMemo(() => user?.user_metadata?.google_password_set === true, [user])

  useEffect(() => {
    if (loading || !user) return

    if (!isGoogleUser || hasGooglePassword) {
      navigate('/app', { replace: true })
    }
  }, [loading, user, isGoogleUser, hasGooglePassword, navigate])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const validationError = getPasswordValidationError(password, confirmPassword)
    if (validationError) {
      toast.error(validationError)
      return
    }

    setSaving(true)
    const { error } = await setGooglePassword(password)
    setSaving(false)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success('Palavra-passe guardada com sucesso.')
    navigate('/app', { replace: true })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #eef7ef 0%, #ffffff 60%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          backgroundColor: '#fff',
          borderRadius: 20,
          border: '1px solid #e6ece7',
          padding: '28px 24px',
          boxShadow: '0 10px 30px rgba(16, 54, 30, 0.10)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24, color: '#122016', fontWeight: 800 }}>Definir palavra-passe</h1>
        <p style={{ marginTop: 8, marginBottom: 20, color: '#58695d', fontSize: 14, lineHeight: 1.5 }}>
          Esta palavra-passe ficara associada ao seu e-mail e sera gravada no backend de autenticacao.
          Depois podera entrar tanto com Google quanto com e-mail e palavra-passe.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#243429' }}>
              Palavra-passe
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 14, top: 16, color: '#7b8c80' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                placeholder="Minimo de 6 caracteres"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: 12,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#607266',
                }}
                aria-label="Mostrar ou ocultar palavra-passe"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#243429' }}>
              Confirmar palavra-passe
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 14, top: 16, color: '#7b8c80' }} />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={inputStyle}
                placeholder="Repita a palavra-passe"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((current) => !current)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: 12,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: '#607266',
                }}
                aria-label="Mostrar ou ocultar confirmacao da palavra-passe"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              marginTop: 6,
              height: 46,
              borderRadius: 12,
              border: 'none',
              backgroundColor: '#2f7e3d',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'A guardar...' : 'Guardar e entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
