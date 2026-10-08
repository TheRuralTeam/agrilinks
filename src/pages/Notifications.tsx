import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import usePushNotifications from '../components/usePushNotifications';
import { Badge } from '../components/ui/badge';
import {
  Bell,
  Heart,
  MessageCircle,
  Package,
  CheckCircle,
  X,
  AlertCircle,
  Zap,
  ArrowLeft,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../integrations/supabase/client';
import { getNotificationTargetPath } from '../lib/notificationNavigation';
import Loader from '../components/ui/Loader';

const T = {
  g900: '#2c863b', g600: '#2c863b', g50: '#F2FAF3', gBorder: '#C8E6CA',
  e700: '#5C3317', ink: '#111714', mid: '#3D4D40', muted: '#758A79',
  faint: '#A8BAA9', canvas: '#F7F9F7', white: '#FFFFFF', rule: '#E5EDE6',
  gold: '#B07D0A', shadow: 'rgba(13,43,18,0.10)',
};

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  metadata?: Record<string, unknown> | null;
  user_id: string;
}

const Notifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pushNotifications = usePushNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      setNotifications((data ?? []) as Notification[]);
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    if (!user?.id) return false;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('user_id', user.id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
      return true;
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
      toast.error('Não foi possível sincronizar a leitura desta notificação.');
      return false;
    }
  }, [user?.id]);

  const openNotification = useCallback(async (notification: Notification) => {
    if (!notification.read) await markAsRead(notification.id);
    navigate(getNotificationTargetPath(notification));
  }, [markAsRead, navigate]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
      if (error) throw error;
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success('Todas as notificações foram marcadas como lidas.');
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
      toast.error('Não foi possível marcar todas as notificações como lidas.');
    }
  }, [user]);

  const deleteNotification = useCallback(async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success('Notificação eliminada.');
    } catch (error) {
      console.error('Erro ao eliminar notificação:', error);
      toast.error('Não foi possível eliminar a notificação.');
    }
  }, [user]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'interest': case 'reaction': return <Heart className="h-5 w-5" style={{ color: T.e700 }} />;
      case 'message': return <MessageCircle className="h-5 w-5" style={{ color: T.g900 }} />;
      case 'product': case 'pre_order_accepted': return <Package className="h-5 w-5" style={{ color: T.g600 }} />;
      case 'system': case 'referral': return <Zap className="h-5 w-5" style={{ color: T.gold }} />;
      default: return <Bell className="h-5 w-5" style={{ color: T.muted }} />;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('pt-AO');
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: T.canvas }}><Loader compact /></div>;
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: T.canvas }}>
      <header className="sticky top-0 z-50" style={{ background: T.white, borderBottom: `1px solid ${T.rule}`, boxShadow: `0 2px 8px ${T.shadow}` }}>
        <div className="px-4 py-4 flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} style={{ color: T.mid }}><ArrowLeft className="h-5 w-5" /></Button>
            <h1 className="text-xl font-bold" style={{ color: T.ink }}>Notificações</h1>
            {unreadCount > 0 && <Badge style={{ background: T.g900, color: T.white }}>{unreadCount}</Badge>}
          </div>
          {unreadCount > 0 && <Button variant="ghost" size="sm" onClick={markAllAsRead} style={{ color: T.g900, fontSize: 12 }}>Marcar todas</Button>}
        </div>
      </header>

      {pushNotifications.isSupported && !pushNotifications.isSubscribed && (
        <div className="max-w-3xl mx-auto px-4 pt-4">
          <Card style={{ background: `linear-gradient(135deg, ${T.g900}, ${T.g600})`, border: 'none', borderRadius: 16 }}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}><Bell className="h-5 w-5 text-white" /></div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-white">Activar notificações push</h3>
                <p className="text-xs mt-0.5 text-white/75">Receba alertas mesmo quando a aplicação não estiver aberta.</p>
              </div>
              <Button size="sm" onClick={() => void pushNotifications.subscribe()} disabled={pushNotifications.isLoading} style={{ background: T.white, color: T.g900, fontWeight: 700, fontSize: 12, borderRadius: 10 }}>
                {pushNotifications.isLoading ? 'A activar…' : 'Activar'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {pushNotifications.isSupported && pushNotifications.isSubscribed && (
        <div className="max-w-3xl mx-auto px-4 pt-4">
          <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: T.g50, border: `1px solid ${T.gBorder}` }}>
            <CheckCircle className="h-4 w-4" style={{ color: T.g900 }} />
            <span className="text-xs font-semibold" style={{ color: T.g900 }}>Notificações push activas</span>
            <button onClick={() => void pushNotifications.unsubscribe()} className="ml-auto text-xs underline" style={{ color: T.muted }}>Desactivar</button>
          </div>
        </div>
      )}

      {pushNotifications.error && (
        <div className="max-w-3xl mx-auto px-4 pt-2">
          <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
            <AlertCircle className="h-4 w-4" style={{ color: '#DC2626' }} />
            <span className="text-xs" style={{ color: '#DC2626' }}>{pushNotifications.error}</span>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {notifications.map((notification) => (
          <Card
            key={notification.id}
            style={{ background: notification.read ? T.white : T.g50, border: `1px solid ${notification.read ? T.rule : T.gBorder}` }}
            className="cursor-pointer transition-all hover:shadow-md overflow-hidden"
            onClick={() => void openNotification(notification)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="mt-1 p-2 rounded-full shrink-0" style={{ background: notification.read ? T.canvas : T.white }}>
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm sm:text-base" style={{ color: notification.read ? T.mid : T.ink }}>{notification.title}</h3>
                    <span className="text-[10px] uppercase tracking-wider font-medium shrink-0" style={{ color: T.faint }}>{formatDate(notification.created_at)}</span>
                  </div>
                  <p className="text-sm mt-1 leading-relaxed" style={{ color: T.muted }}>{notification.message}</p>
                  {!notification.read && <div className="flex items-center gap-1.5 mt-2"><div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: T.g900 }} /><span className="text-[10px] font-bold uppercase" style={{ color: T.g900 }}>Nova</span></div>}
                </div>
                <button onClick={(e) => { e.stopPropagation(); void deleteNotification(notification.id); }} className="p-1 hover:bg-black/5 rounded-full transition-colors shrink-0" aria-label="Eliminar notificação">
                  <X className="h-4 w-4" style={{ color: T.faint }} />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}

        {notifications.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm" style={{ border: `1px solid ${T.rule}` }}><Bell className="h-10 w-10" style={{ color: T.faint }} /></div>
            <p className="font-bold text-lg" style={{ color: T.ink }}>Tudo em dia!</p>
            <p className="text-sm mt-2 max-w-xs mx-auto" style={{ color: T.muted }}>Não tens notificações novas. Avisaremos-te assim que houver novidades sobre os teus produtos ou mensagens.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
