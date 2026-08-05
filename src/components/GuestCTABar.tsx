import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { X, UserPlus } from 'lucide-react'
import { T, FONT } from '@/lib/brand'
import { useGuestGate } from '@/contexts/GuestGateContext'
import { guestMinutesLeft } from '@/lib/guestSession'

const MESSAGES: { match: (p: string) => boolean; text: string }[] = [
  { match: p => p.startsWith('/perfil'), text: 'Faz cadastro para guardar o teu perfil de verdade' },
  { match: p => p.startsWith('/publicar-produto'), text: 'Cria conta para publicar este produto de verdade' },
  { match: p => p.startsWith('/ficharecebimento'), text: 'Cria conta para enviar a tua ficha técnica aos fornecedores' },
  { match: p => p.startsWith('/listamensagens') || p.startsWith('/messages'), text: 'Cria conta para falar com fornecedores e compradores' },
  { match: p => p.startsWith('/mercado'), text: 'Cria conta para acompanhar preços e negociar no mercado' },
  { match: p => p.startsWith('/mapa'), text: 'Cria conta para contactar os produtores que vês no mapa' },
  { match: p => p.startsWith('/contratos'), text: 'Cria conta para gerar e descarregar contratos digitais' },
  { match: () => true, text: 'Cria a tua conta para comprar e falar com fornecedores' },
]

const GuestCTABar = () => {
  const { isGuest } = useGuestGate()
  const location = useLocation()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = useState(false)
  const [minutes, setMinutes] = useState(guestMinutesLeft())

  // Reaparece sempre que se muda de página
  useEffect(() => { setDismissed(false); setMinutes(guestMinutesLeft()) }, [location.pathname])

  useEffect(() => {
    if (!isGuest) return
    const i = setInterval(() => setMinutes(guestMinutesLeft()), 60000)
    return () => clearInterval(i)
  }, [isGuest])

  const hiddenOn = ['/login', '/cadastro', '/confirmar-email', '/auth/callback', '/reset-password', '/site']
  if (!isGuest || dismissed || hiddenOn.some(p => location.pathname.startsWith(p))) return null

  const text = MESSAGES.find(m => m.match(location.pathname))!.text

  return (
    <div
      style={{
        position: 'fixed', left: 10, right: 10, bottom: 12, zIndex: 60,
        maxWidth: 660, margin: '0 auto',
        background: T.white, border: `1px solid ${T.gBorder}`,
        borderRadius: 18, padding: '12px 14px',
        boxShadow: '0 12px 34px rgba(13,43,18,0.16)',
        display: 'flex', alignItems: 'center', gap: 12,
        fontFamily: FONT,
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 12, background: T.g50, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <UserPlus size={18} color={T.green} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, lineHeight: 1.3 }}>{text}</div>
        <button
          onClick={() => navigate('/login')}
          style={{
            marginTop: 2, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontFamily: FONT, fontSize: 11.5, fontWeight: 600, color: T.muted, textDecoration: 'underline',
          }}
        >
          Já tenho conta{minutes > 0 ? ` · modo teste expira em ${minutes} min` : ''}
        </button>
      </div>

      <button
        onClick={() => navigate('/cadastro')}
        style={{
          flexShrink: 0, padding: '10px 16px', borderRadius: 12, border: 'none',
          background: T.green, color: T.white, fontFamily: FONT,
          fontSize: 13.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        Cadastrar
      </button>

      <button
        aria-label="Fechar"
        onClick={() => setDismissed(true)}
        style={{
          flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
          color: T.faint, padding: 4, display: 'flex',
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
}

export default GuestCTABar
