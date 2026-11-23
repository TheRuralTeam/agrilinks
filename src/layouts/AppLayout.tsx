import React from 'react'
import { useLocation } from 'react-router-dom'
import BottomNavigation from '../components/BottomNavigation'
import { useNavigate } from 'react-router-dom'
import { useGuestGate } from '../contexts/GuestGateContext'
import { R, T } from '../lib/brand'
import { LogIn, UserPlus } from 'lucide-react'

interface AppLayoutProps {
  children: React.ReactNode
}

// Páginas onde o BottomNavigation não deve aparecer
const HIDDEN_NAV_ROUTES = ['/mapa-app', '/notificacoes']

const AppLayout = ({ children }: AppLayoutProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { isGuest, minutesLeft } = useGuestGate()
  const pathname = location.pathname
  
  // Verificar se deve esconder a navegação inferior
  const shouldHideNav = 
    HIDDEN_NAV_ROUTES.includes(pathname) || 
    pathname.startsWith('/messages')  // Cobre /messages e /messages/:id

  return (
    <div className="min-h-screen bg-background">
      {children}
      {isGuest && (
        <aside
          aria-label="Convite do modo visitante"
          style={{
            position:'fixed', zIndex:60, left:12, right:12, bottom:16,
            maxWidth:560, margin:'0 auto', display:'flex', alignItems:'center', gap:10,
            padding:'12px', borderRadius:R.md, border:`1px solid ${T.gBorder}`,
            background:'rgba(255,255,255,0.96)', boxShadow:'0 16px 44px rgba(17,24,20,.18)',
            backdropFilter:'blur(14px)',
          }}
        >
          <div style={{ flex:1, minWidth:0 }}>
            <strong style={{ display:'block', fontSize:13, color:T.ink }}>Explore a rede completa</strong>
            <span style={{ display:'block', marginTop:2, fontSize:11, color:T.muted, lineHeight:1.45 }}>
              Perfil temporário · {minutesLeft} min restantes
            </span>
          </div>
          <button type="button" onClick={() => navigate('/login')} style={{ height:40, padding:'0 11px', borderRadius:R.sm, border:`1px solid ${T.rule}`, background:T.white, color:T.ink, fontSize:12, fontWeight:800, display:'inline-flex', alignItems:'center', gap:6 }}>
            <LogIn size={14}/> Entrar
          </button>
          <button type="button" onClick={() => navigate('/cadastro')} style={{ height:40, padding:'0 11px', borderRadius:R.sm, border:0, background:T.g600, color:T.white, fontSize:12, fontWeight:800, display:'inline-flex', alignItems:'center', gap:6 }}>
            <UserPlus size={14}/> Criar conta
          </button>
        </aside>
      )}
      {!shouldHideNav && <BottomNavigation />}
    </div>
  )
}

export default AppLayout