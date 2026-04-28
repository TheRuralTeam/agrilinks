import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, Map, Bell, MessageSquare, User, Plus, LayoutDashboard, BarChart3, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'

/* ─── Manus AI x AgriLink Design System (Light Mode) ─────────────────────── */
const B = {
  // AgriLink Core
  brand:      '#1B8A3D', // Verde principal
  brandLight: '#72B344', // Verde alface
  
  // Manus AI Neutrals (Light)
  ink:        '#0A0C0B', // Quase preto profundo
  slate:      '#4A4F4C', // Cinza ardósia
  silver:     '#E2E4E2', // Prata para bordas
  white:      '#FFFFFF',
  snow:       '#F9FAFA', // Branco neve para fundos
  
  // Transparencies
  glass:      'rgba(255, 255, 255, 0.9)', // Vidro branco
  shadow:     'rgba(10, 12, 11, 0.08)',
}

interface NavItem {
  icon: LucideIcon
  label: string
  path: string
  isAction?: boolean
  badge?: number
}

const BottomNavigation = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin, user } = useAuth()
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)

  useEffect(() => {
    if (!user?.id) return
    const fetchCounts = async () => {
      const { count: notifCount } = await supabase
        .from('notifications').select('*', { count:'exact', head:true })
        .eq('user_id', user.id).eq('read', false)
      setUnreadNotifications(notifCount || 0)

      const { count: msgCount } = await supabase
        .from('messages').select('*', { count:'exact', head:true })
        .eq('receiver_id', user.id).eq('read', false)
      setUnreadMessages(msgCount || 0)
    }
    fetchCounts()

    const notifChannel = supabase.channel('notifications-count')
      .on('postgres_changes', { event:'*', schema:'public', table:'notifications', filter:`user_id=eq.${user.id}` }, fetchCounts)
      .subscribe()
    const msgChannel = supabase.channel('messages-count')
      .on('postgres_changes', { event:'*', schema:'public', table:'messages', filter:`receiver_id=eq.${user.id}` }, fetchCounts)
      .subscribe()

    return () => { supabase.removeChannel(notifChannel); supabase.removeChannel(msgChannel) }
  }, [user?.id])

  // Item de publicação (Ação principal)
  const publishItem: NavItem = { 
    icon: Plus, 
    label: t('navigation.publish'), 
    path: '/publicar-produto', 
    isAction: true 
  }

  // Itens de navegação (7 itens no total)
  const navItems: NavItem[] = [
    { icon: Home, label: t('navigation.home'), path: '/app' },
    isAdmin
      ? { icon: LayoutDashboard, label: 'Admin', path: '/admindashboard' }
      : { icon: Map, label: t('navigation.map'), path: '/mapa' },
    { icon: MessageSquare, label: t('navigation.messages'), path: '/listamensagens', badge: unreadMessages },
    publishItem, // Posição central (4 de 7)
    { icon: Bell, label: t('navigation.notifications'), path: '/notificacoes', badge: unreadNotifications },
    { icon: BarChart3, label: 'Mercado', path: '/mercado' }, // Rota corrigida para /mercado
    { icon: User, label: t('navigation.profile'), path: '/perfil' },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <>
      {/* Spacer */}
      <div style={{ height: 80 }}/>

      <nav style={{
        position:'fixed', bottom: 15, left: 8, right: 8, zIndex: 50,
        background: B.glass,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${B.silver}`,
        borderRadius: 24,
        padding: '6px 4px',
        boxShadow: `0 12px 32px ${B.shadow}`,
        maxWidth: 650,
        margin: '0 auto'
      }}>
        <div style={{
          display:'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
        }}>
          {navItems.map((item) => {
            const active = isActive(item.path)
            const isAction = item.isAction

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display:'flex', flexDirection:'column', alignItems:'center',
                  gap: 2, padding: '6px 2px', border:'none', cursor:'pointer',
                  borderRadius: 12, background: isAction ? B.brand : 'transparent',
                  transition:'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position:'relative',
                  flex: 1,
                  minWidth: 0,
                  ...(isAction ? {
                    boxShadow: `0 6px 12px rgba(27, 138, 61, 0.25)`,
                    transform: active ? 'scale(1.05)' : 'scale(1)',
                    padding: '8px 4px',
                  } : {}),
                }}
              >
                {/* Active Indicator Dot */}
                {active && !isAction && (
                  <div style={{
                    position:'absolute', top: -2, width: 3, height: 3, 
                    borderRadius: '50%', background: B.brand,
                  }}/>
                )}

                <div style={{ position:'relative' }}>
                  <item.icon
                    size={isAction ? 18 : 20}
                    strokeWidth={active ? 2.5 : 2}
                    color={
                      isAction ? B.white :
                      active ? B.brand :
                      'rgba(10, 12, 11, 0.4)'
                    }
                    style={{ transition:'all 0.2s' }}
                  />
                  {(item.badge || 0) > 0 && (
                    <span style={{
                      position:'absolute', top: -4, right: -6,
                      minWidth: 14, height: 14, borderRadius: '50%',
                      background: B.brandLight,
                      border: `1px solid ${B.white}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, fontWeight: 800, color: B.white,
                    }}>
                      {(item.badge || 0) > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>

                <span style={{
                  fontSize: 8, fontWeight: active ? 700 : 500,
                  color: isAction ? B.white : active ? B.brand : 'rgba(10, 12, 11, 0.4)',
                  letterSpacing: '-0.02em',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  width: '100%',
                  textAlign: 'center'
                }}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}

export default BottomNavigation
