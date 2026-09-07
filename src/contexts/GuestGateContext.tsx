import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { Dialog, DialogContent } from '../components/ui/dialog'
import { T, FONT } from '../lib/brand'
import { ensureGuestSession, guestMinutesLeft } from '../lib/guestSession'
import { UserPlus, LogIn, ShieldCheck } from 'lucide-react'

interface GuestGateValue {
  /** true quando não há sessão real (visitante a experimentar a plataforma) */
  isGuest: boolean
  minutesLeft: number
  /**
   * Garante que existe conta real. Devolve true se pode prosseguir,
   * false se abriu o modal de cadastro.
   */
  requireAuth: (reason?: string) => boolean
}

const GuestGateContext = createContext<GuestGateValue | undefined>(undefined)

export const useGuestGate = () => {
  const ctx = useContext(GuestGateContext)
  if (!ctx) throw new Error('useGuestGate must be used within GuestGateProvider')
  return ctx
}

export const GuestGateProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [reason, setReason] = useState<string | null>(null)

  const isGuest = !loading && !user

  React.useEffect(() => {
    if (!isGuest) return

    try {
      ensureGuestSession()
    } catch {
      // A sessão de visitante deve degradar em silêncio quando o armazenamento não está disponível.
    }
  }, [isGuest])

  const requireAuth = useCallback((r?: string) => {
    if (user) return true

    const nextReason = r || 'Precisas de uma conta AgriLink para continuar.'
    setReason(nextReason)
    return false
  }, [user])

  const value = useMemo<GuestGateValue>(() => ({
    isGuest,
    minutesLeft: isGuest ? guestMinutesLeft() : 0,
    requireAuth,
  }), [isGuest, requireAuth])

  return (
    <GuestGateContext.Provider value={value}>
      {children}
      <Dialog open={!!reason} onOpenChange={(o) => !o && setReason(null)}>
        <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden" style={{ fontFamily: FONT, borderRadius: 20 }}>
          <div style={{ padding: '28px 24px 24px', background: T.white }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16, background: T.g50,
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <ShieldCheck size={26} color={T.green} />
            </div>
            <h2 style={{ fontFamily: FONT, fontSize: 20, fontWeight: 800, color: T.ink, margin: 0, letterSpacing: '-0.02em' }}>
              Cria a tua conta AgriLink
            </h2>
            <p style={{ fontSize: 14, color: T.mid, marginTop: 8, lineHeight: 1.55 }}>
              {reason}
            </p>
            <p style={{ fontSize: 12.5, color: T.faint, marginTop: 10, lineHeight: 1.5 }}>
              Estás em modo de teste: o que criares agora fica só no teu dispositivo e expira em breve.
            </p>

            <button
              onClick={() => { setReason(null); navigate('/cadastro') }}
              style={{
                marginTop: 22, width: '100%', padding: '13px 16px', borderRadius: 14, border: 'none',
                background: T.green, color: T.white, fontFamily: FONT, fontSize: 15, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <UserPlus size={17} /> Cadastrar gratuitamente
            </button>
            <button
              onClick={() => { setReason(null); navigate('/login') }}
              style={{
                marginTop: 10, width: '100%', padding: '11px 16px', borderRadius: 14,
                border: `1px solid ${T.rule}`, background: T.white, color: T.mid,
                fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <LogIn size={15} /> Já tenho conta
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </GuestGateContext.Provider>
  )
}
