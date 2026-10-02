import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, Map, Bell, MessageSquare, User, Plus, LayoutDashboard, BarChart3, Truck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../integrations/supabase/client'

const BottomNavigation = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin, user, userProfile } = useAuth()
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

  const isDriver = (userProfile as any)?.user_type === 'motorista'

  // Item de publicação (Ação principal)
  const publishItem = isDriver
    ? { id: 'publish', icon: Truck, label: 'Cargas', path: '/cargas', isAction: true }
    : {
      id: 'publish',
        icon: Plus,
        label: t('navigation.publish'),
        path: '/publicar-produto',
        isAction: true,
      }

  // Itens de navegação (7 itens no total)
  const navItems = [
    { id: 'nav-home', icon: Home, label: t('navigation.home'), path: '/app' },
    isAdmin
      ? { id: 'nav-admin', icon: LayoutDashboard, label: 'Admin', path: '/admindashboard' }
      : { id: 'nav-map', icon: Map, label: t('navigation.map'), path: '/mapa' },
    { id: 'nav-messages', icon: MessageSquare, label: t('navigation.messages'), path: '/listamensagens', badge: unreadMessages },
    publishItem, // Posição central (4 de 7)
    { id: 'nav-notifications', icon: Bell, label: t('navigation.notifications'), path: '/notificacoes', badge: unreadNotifications },
    { id: 'nav-market', icon: BarChart3, label: 'Mercado', path: '/mercado' },
    { id: 'nav-profile', icon: User, label: t('navigation.profile'), path: '/perfil' },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <>
      <div className="h-24" aria-hidden="true" />

      <nav className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-2xl border border-border/70 bg-white p-1.5 shadow-medium supports-[padding:max(0px)]:pb-[max(0.375rem,env(safe-area-inset-bottom))]" aria-label="Navegação principal">
        <div className="flex items-stretch justify-around gap-0.5">
          {navItems.map((item) => {
            const active = isActive(item.path)
            const isAction = (item as any).isAction
            const itemLabel = String(item.label ?? '')

            return (
              <button
                key={`${item.id}-${item.path}`}
                type="button"
                onClick={() => navigate(item.path)}
                aria-label={itemLabel}
                title={itemLabel}
                className={`relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  isAction
                    ? 'bg-primary text-primary-foreground shadow-soft active:scale-[0.97]'
                    : active
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted active:bg-muted/80'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                  <item.icon
                    size={isAction ? 19 : 20}
                    strokeWidth={active ? 2.5 : 2}
                    aria-hidden="true"
                  />
                  {(item as any).badge > 0 && (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-card bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                      {(item as any).badge > 99 ? '99+' : (item as any).badge}
                    </span>
                  )}
                </div>

                <span className="flex min-h-[1.1rem] w-full items-center justify-center overflow-hidden text-center text-[10px] font-medium leading-none tracking-tight">
                  <span className="block max-w-full truncate">{itemLabel}</span>
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
