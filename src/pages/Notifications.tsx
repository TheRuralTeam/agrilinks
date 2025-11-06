import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell, Heart, MessageCircle, Package, CheckCircle, Settings } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'

interface Notification {
  id: string
  type: 'interest' | 'message' | 'product' | 'system'
  title: string
  message: string
  read: boolean
  created_at: string
  data?: any
  user_id: string
}

const Notifications = () => {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  // 🔄 Buscar notificações do Supabase
  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setNotifications(data as any)
    } catch (error) {
      console.error('Erro ao buscar notificações:', error)
      toast({
        title: 'Erro ao carregar notificações',
        description: 'Não foi possível buscar suas notificações agora.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // 🔔 Subscrever a eventos em tempo real
  const subscribeToRealtimeNotifications = () => {
    const channel = supabase
      .channel('realtime:notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          console.log('Mudança detectada:', payload)
          if (payload.eventType === 'INSERT') {
            setNotifications((prev) => [payload.new as Notification, ...prev])
            toast({
              title: (payload.new as Notification).title || 'Nova notificação',
              description: (payload.new as Notification).message,
            })
          }
          if (payload.eventType === 'UPDATE') {
            setNotifications((prev) =>
              prev.map((n) =>
                n.id === payload.new.id ? (payload.new as Notification) : n
              )
            )
          }
          if (payload.eventType === 'DELETE') {
            setNotifications((prev) =>
              prev.filter((n) => n.id !== payload.old.id)
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  // 👁️ Marcar uma notificação como lida
  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id)

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      )
    } catch (error) {
      console.error('Erro ao marcar como lida:', error)
    }
  }

  // ✅ Marcar todas como lidas
  const markAllAsRead = async () => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error)
    }
  }

  // 🔄 UseEffect principal
  useEffect(() => {
    if (!user) return
    fetchNotifications()
    const unsubscribe = subscribeToRealtimeNotifications()
    return () => unsubscribe()
  }, [user])

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'interest':
        return <Heart className="h-5 w-5 text-red-500" />
      case 'message':
        return <MessageCircle className="h-5 w-5 text-blue-500" />
      case 'product':
        return <Package className="h-5 w-5 text-primary" />
      case 'system':
        return <Bell className="h-5 w-5 text-accent" />
      default:
        return <Bell className="h-5 w-5 text-muted-foreground" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Agora mesmo'
    if (minutes < 60) return `${minutes}m atrás`
    if (hours < 24) return `${hours}h atrás`
    if (days < 7) return `${days}d atrás`
    return date.toLocaleDateString('pt-BR')
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  if (loading) {
    return (
      <div className="pb-20 bg-background min-h-screen">
        <div className="flex items-center justify-center pt-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-20 bg-background min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-primary">Notificações</h1>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Marcar todas como lidas
              </Button>
            )}
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="px-4 py-4 space-y-3">
        {notifications.map((notification) => (
          <Card
            key={notification.id}
            className={`shadow-soft border-card-border cursor-pointer transition-all hover:shadow-medium ${
              !notification.read ? 'bg-primary/5 border-primary/20' : ''
            }`}
            onClick={() => markAsRead(notification.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      className={`font-semibold text-sm ${
                        !notification.read ? 'text-primary' : ''
                      }`}
                    >
                      {notification.title}
                    </h3>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(notification.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {notification.message}
                  </p>
                  {!notification.read && (
                    <div className="flex items-center gap-1 mt-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span className="text-xs text-primary font-medium">Não lida</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {notifications.length === 0 && (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Nenhuma notificação ainda</p>
            <p className="text-sm text-muted-foreground mt-2">
              Você receberá notificações sobre atividades em seus produtos
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Notifications
