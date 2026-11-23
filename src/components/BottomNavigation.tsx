import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, Map, Bell, MessageSquare, User, Plus, LayoutDashboard, Truck, ShoppingCart, Route, Search } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../integrations/supabase/client'
import { BUYER_CART_UPDATED_EVENT, getBuyerCartQuantity } from '../features/marketplace/buyerCart'
import { useGuestGate } from '../contexts/GuestGateContext'
import FloatingActionButton from './FloatingActionButton'

const BottomNavigation = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAdmin, isRootAdmin, isSuperRoot, user, userProfile } = useAuth()
  const { isGuest } = useGuestGate()
  const [unreadNotifications, setUnreadNotifications] = useState<number | null>(null)
  const [unreadMessages, setUnreadMessages] = useState<number | null>(null)
  const [buyerCartQuantity, setBuyerCartQuantity] = useState(0)
  const userType = String((userProfile as any)?.user_type ?? '').toLowerCase()

  useEffect(() => {
    if (!user?.id) {
      setUnreadNotifications(null)
      setUnreadMessages(null)
      return
    }

    let active = true
    let requestSequence = 0

    const fetchCounts = async () => {
      const currentSequence = ++requestSequence
      try {
        const [notificationResult, messageResult] = await Promise.all([
          supabase
            .from('notifications').select('*', { count:'exact', head:true })
            .eq('user_id', user.id).eq('read', false),
          supabase
            .from('messages').select('*', { count:'exact', head:true })
            .eq('receiver_id', user.id).eq('read', false),
        ])

        if (!active || currentSequence !== requestSequence) return
        setUnreadNotifications(notificationResult.error ? null : notificationResult.count ?? 0)
        setUnreadMessages(messageResult.error ? null : messageResult.count ?? 0)
      } catch {
        if (!active || currentSequence !== requestSequence) return
        setUnreadNotifications(null)
        setUnreadMessages(null)
      }
    }

    void fetchCounts()

    const notifChannel = supabase.channel(`notifications-count-${user.id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'notifications', filter:`user_id=eq.${user.id}` }, fetchCounts)
      .subscribe()
    const msgChannel = supabase.channel(`messages-count-${user.id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'messages', filter:`receiver_id=eq.${user.id}` }, fetchCounts)
      .subscribe()

    return () => {
      active = false
      requestSequence += 1
      void supabase.removeChannel(notifChannel)
      void supabase.removeChannel(msgChannel)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id || userType !== 'comprador') {
      setBuyerCartQuantity(0)
      return
    }
    const refreshCartCount = (event?: Event) => {
      const customEvent = event as CustomEvent<{ userId?: string }> | undefined
      if (customEvent?.detail?.userId && customEvent.detail.userId !== user.id) return
      setBuyerCartQuantity(getBuyerCartQuantity(user.id))
    }
    refreshCartCount()
    window.addEventListener(BUYER_CART_UPDATED_EVENT, refreshCartCount)
    window.addEventListener('storage', refreshCartCount)
    return () => {
      window.removeEventListener(BUYER_CART_UPDATED_EVENT, refreshCartCount)
      window.removeEventListener('storage', refreshCartCount)
    }
  }, [user?.id, userType])

  const isDriver = userType === 'motorista'
  const isBuyer = userType === 'comprador'
  const canSeeAdmin = isAdmin || isRootAdmin || isSuperRoot

  // A acção principal varia conforme o papel real do utilizador.
  const publishItem = isGuest
    ? { id: 'publish', icon: User, label: 'Entrar', path: '/login', isAction: true }
    : isDriver
    ? { id: 'publish', icon: Truck, label: 'Cargas', path: '/cargas', isAction: true }
    : isBuyer
      ? { id: 'publish', icon: ShoppingCart, label: 'Carrinho', path: '/carrinho', isAction: true, cartCount: buyerCartQuantity }
      : canSeeAdmin
        ? { id: 'publish', icon: Route, label: 'Rotas', path: '/admindashboard?tab=routes', isAction: true }
        : { id: 'publish', icon: Plus, label: t('navigation.publish'), path: '/publicar-produto', isAction: true }

  // Itens de navegação (7 itens no total)
  const navItems = isGuest ? [
    { id: 'nav-home', icon: Home, label: 'Início', path: '/app' },
    { id: 'nav-search', icon: Search, label: 'Pesquisar', path: '/search' },
    { id: 'nav-login', icon: User, label: 'Entrar', path: '/login', isAction: true },
  ] : [
    { id: 'nav-home', icon: Home, label: t('navigation.home', { defaultValue: 'Início' }), path: '/app' },
    { id: 'nav-map', icon: Map, label: t('navigation.map'), path: '/mapa' },
    { id: 'nav-messages', icon: MessageSquare, label: t('navigation.messages'), path: '/listamensagens', badge: unreadMessages },
    publishItem,
    { id: 'nav-notifications', icon: Bell, label: t('navigation.notifications'), path: '/notificacoes', badge: unreadNotifications },
    { id: 'nav-profile', icon: User, label: t('navigation.profile'), path: '/perfil' },
  ]

  const isActive = (item: (typeof navItems)[number]) => {
    const [path, query] = item.path.split('?')
    if (location.pathname === path) {
      return !query || location.search === `?${query}`
    }

    if (item.id === 'nav-messages') return location.pathname.startsWith('/messages/')
    if (item.id === 'nav-profile') return location.pathname.startsWith('/perfil/') || location.pathname.startsWith('/empresa/')
    if (item.id === 'nav-map') return location.pathname === '/mapa-app'
    return path !== '/app' && location.pathname.startsWith(`${path}/`)
  }

  return (
    <>
      <div className="h-24" aria-hidden="true" />

      <nav className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl overflow-x-auto overscroll-x-contain rounded-2xl border border-border/70 bg-white p-1.5 shadow-medium [scrollbar-width:none] [&::-webkit-scrollbar]:hidden supports-[padding:max(0px)]:pb-[max(0.375rem,env(safe-area-inset-bottom))]" aria-label="Navegação principal" translate="no">
        <div className="flex min-w-full items-stretch justify-between gap-1">
          {navItems.filter((item) => item.id !== 'nav-profile').map((item) => {
            const active = isActive(item)
            const isAction = (item as any).isAction
            const itemLabel = String(item.label ?? '')
            const badgeValue = Number((item as any).cartCount ?? 0) || Number((item as any).badge ?? 0)
            const accessibleLabel = item.id === 'nav-notifications' && unreadNotifications === null
              ? 'Notificações; contagem indisponível'
              : item.id === 'nav-messages' && unreadMessages === null
                ? 'Mensagens; contagem indisponível'
                : itemLabel

            return (
              <button
                key={`${item.id}-${item.path}`}
                type="button"
                onClick={() => navigate(item.path)}
                aria-label={accessibleLabel}
                title={accessibleLabel}
                className={`relative flex min-h-12 min-w-[4rem] flex-1 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1.5 text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : isAction
                      ? 'hover:bg-muted active:bg-muted/80 active:scale-[0.97]'
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
                  {badgeValue > 0 && (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-card bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                      {badgeValue > 99 ? '99+' : badgeValue}
                    </span>
                  )}
                </div>

                <span className="flex min-h-[1.1rem] w-full items-center justify-center whitespace-nowrap text-center text-[9px] font-medium leading-none tracking-tight sm:text-[10px]">
                  {itemLabel}
                </span>
              </button>
            )
          })}
          {!isGuest && isBuyer && <FloatingActionButton />}
          {navItems.filter((item) => item.id === 'nav-profile').map((item) => {
            const active = isActive(item)
            return (
              <button
                key={`${item.id}-${item.path}`}
                type="button"
                onClick={() => navigate(item.path)}
                aria-label={String(item.label)}
                title={String(item.label)}
                className={`relative flex min-h-12 min-w-[4rem] flex-1 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1.5 text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active ? 'bg-primary/10 text-primary' : 'hover:bg-muted active:bg-muted/80'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                  <User size={20} strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                </span>
                <span className="flex min-h-[1.1rem] w-full items-center justify-center whitespace-nowrap text-center text-[9px] font-medium leading-none tracking-tight sm:text-[10px]">
                  {String(item.label)}
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
