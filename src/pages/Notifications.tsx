import { useCallback, useEffect, useRef, useState } from 'react';
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
import { getNotificationDisplayTitle, getNotificationTargetPath } from '../lib/notificationNavigation';
import Loader from '../components/ui/Loader';
import { R, T } from '../lib/brand';

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
  const userId = user?.id;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const fetchNotifications = useCallback(async (showLoader = true) => {
    const requestId = ++requestSequence.current;
    if (!userId) {
      setNotifications([]);
      setLoadError(null);
      setLoading(false);
      return;
    }
    if (showLoader) setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      if (requestId !== requestSequence.current) return;
      setNotifications((data ?? []) as Notification[]);
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
      if (requestId === requestSequence.current) {
        setLoadError('Não foi possível consultar as notificações. Verifique a ligação e tente novamente.');
      }
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchNotifications();
    if (!userId) return;

    let refreshTimeout: number | undefined;
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchNotifications(false);
    }, 45_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void fetchNotifications(false);
    };
    const refreshWhenOnline = () => void fetchNotifications(false);
    const channel = supabase
      .channel(`notifications-page-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => {
          window.clearTimeout(refreshTimeout);
          refreshTimeout = window.setTimeout(() => void fetchNotifications(false), 150);
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error(`Canal de notificações indisponível: ${status}`);
        }
      });

    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('online', refreshWhenOnline);

    return () => {
      requestSequence.current += 1;
      window.clearTimeout(refreshTimeout);
      window.clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('online', refreshWhenOnline);
      void supabase.removeChannel(channel);
    };
  }, [fetchNotifications, userId]);

  const markAsRead = useCallback(async (id: string) => {
    if (!userId) return false;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('O servidor não confirmou a leitura da notificação.');
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
      return true;
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
      toast.error('Não foi possível sincronizar a leitura desta notificação.');
      return false;
    }
  }, [userId]);

  const openNotification = useCallback((notification: Notification) => {
    const targetPath = getNotificationTargetPath(notification);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      if (targetPath !== '/notificacoes') {
        if (!notification.read) void markAsRead(notification.id);
        navigate(targetPath);
        return;
      }
      toast.info('Esta notificação não tem uma página de destino associada.');
      return;
    }
    setSelectedId(notification.id);
    if (!notification.read) void markAsRead(notification.id);
  }, [markAsRead, navigate]);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false)
        .select('id');
      if (error) throw error;
      const updatedIds = new Set((data ?? []).map((row) => row.id));
      setNotifications((prev) => prev.map((n) => updatedIds.has(n.id) ? { ...n, read: true } : n));
      if (updatedIds.size > 0) toast.success('Todas as notificações foram marcadas como lidas.');
      else toast.info('Não havia notificações por actualizar.');
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
      toast.error('Não foi possível marcar todas as notificações como lidas.');
    }
  }, [userId]);

  const deleteNotification = useCallback(async (id: string) => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('O servidor não confirmou a remoção da notificação.');
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success('Notificação eliminada.');
    } catch (error) {
      console.error('Erro ao eliminar notificação:', error);
      toast.error('Não foi possível eliminar a notificação.');
    }
  }, [userId]);

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
  const selectedNotification = notifications.find((notification) => notification.id === selectedId) ?? notifications[0] ?? null;
  const selectedTarget = selectedNotification ? getNotificationTargetPath(selectedNotification) : null;
  const isProfileTarget = Boolean(selectedTarget?.startsWith('/perfil'));
  const profileTab = isProfileTarget && selectedTarget
    ? new URL(selectedTarget, window.location.origin).searchParams.get('tab')
    : null;
  const profileContext = profileTab === 'products'
    ? { title: 'Os seus produtos', description: 'Esta notificação está relacionada com os produtos publicados no seu perfil.', action: 'Abrir produtos' }
    : profileTab === 'orders'
      ? { title: 'Os seus pedidos', description: 'Esta notificação está relacionada com os pedidos associados ao seu perfil.', action: 'Abrir pedidos' }
      : profileTab === 'referrals'
        ? { title: 'As suas indicações', description: 'Esta notificação está relacionada com a actividade da sua rede de indicações.', action: 'Abrir indicações' }
        : profileTab === 'sourcing'
          ? { title: 'Os seus pedidos de sourcing', description: 'Esta notificação está relacionada com os pedidos de sourcing do seu perfil.', action: 'Abrir sourcing' }
          : { title: 'O seu perfil', description: 'Esta notificação está relacionada com os dados e a actividade do seu perfil.', action: 'Abrir perfil' };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: T.canvas }}><Loader compact /></div>;
  }

  return (
    <main className="min-h-screen pb-28" style={{ background: T.canvas, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <header className="sticky top-0 z-30" style={{ background: T.white, borderBottom: `1px solid ${T.rule}` }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => navigate(-1)} style={{ color: T.mid, borderRadius: R.md }}><ArrowLeft className="h-5 w-5" /></Button>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: T.g600 }}>AgriLink</p>
              <h1 className="text-xl font-bold" style={{ color: T.ink }}>Notificações</h1>
            </div>
            {unreadCount > 0 && <Badge style={{ background: T.g50, color: T.g900, borderRadius: R.pill }}>{unreadCount}</Badge>}
          </div>
          {unreadCount > 0 && <Button variant="ghost" size="sm" onClick={markAllAsRead} style={{ color: T.g900, fontSize: 12, borderRadius: R.md }}>Marcar todas</Button>}
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(19rem,0.82fr)_minmax(0,1.18fr)]">
      <div className="min-w-0 space-y-4">
      {!pushNotifications.isSupported && pushNotifications.supportMessage && (
        <div>
          <Card style={{ background: T.white, border: `1px solid ${T.rule}`, borderRadius: R.md }}>
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: T.gold }} />
              <div className="min-w-0">
                <h3 className="font-bold text-sm" style={{ color: T.ink }}>Configurar notificações neste dispositivo</h3>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: T.muted }}>{pushNotifications.supportMessage}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {pushNotifications.isSupported && !pushNotifications.isSubscribed && typeof Notification !== 'undefined' && Notification.permission === 'denied' && (
        <Card role="status" style={{ background: T.white, border: `1px solid ${T.goldBorder}`, borderRadius: R.md }}>
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: T.gold }} />
            <div className="min-w-0">
              <h3 className="font-bold text-sm" style={{ color: T.ink }}>Notificações bloqueadas neste navegador</h3>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: T.muted }}>Nas definições do navegador, permita notificações para este site e recarregue a página. Enquanto isso, as notificações continuam disponíveis aqui.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {pushNotifications.isSupported && !pushNotifications.isSubscribed && typeof Notification !== 'undefined' && Notification.permission !== 'denied' && (
        <div>
          <Card style={{ background: `linear-gradient(135deg, ${T.g900}, ${T.g600})`, border: 'none', borderRadius: R.md }}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}><Bell className="h-5 w-5 text-white" /></div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm text-white">Activar notificações push</h3>
                <p className="text-xs mt-0.5 text-white/75">Receba alertas mesmo quando a aplicação não estiver aberta.</p>
              </div>
              <Button size="sm" onClick={() => void pushNotifications.subscribe()} disabled={pushNotifications.isLoading} style={{ background: T.white, color: T.g900, fontWeight: 700, fontSize: 12, borderRadius: R.sm }}>
                {pushNotifications.isLoading ? 'A activar…' : 'Activar'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {pushNotifications.isSupported && pushNotifications.isSubscribed && (
        <div>
          <div className="flex items-center gap-2 p-3" style={{ background: T.g50, border: `1px solid ${T.gBorder}`, borderRadius: R.md }}>
            <CheckCircle className="h-4 w-4" style={{ color: T.g900 }} />
            <span className="text-xs font-semibold" style={{ color: T.g900 }}>Notificações push activas</span>
            <button onClick={() => void pushNotifications.unsubscribe()} className="ml-auto text-xs underline" style={{ color: T.muted }}>Desactivar</button>
          </div>
        </div>
      )}

      {pushNotifications.error && (
        <div>
          <div className="flex items-center gap-2 p-3" style={{ background: T.dangerBg, border: `1px solid ${T.danger}`, borderRadius: R.md }}>
            <AlertCircle className="h-4 w-4" style={{ color: T.danger }} />
            <span className="text-xs" style={{ color: T.danger }}>{pushNotifications.error}</span>
          </div>
        </div>
      )}

      <section aria-label="Lista de notificações" className="space-y-3">
        {loadError && (
          <Card role="alert" style={{ background: T.white, border: `1px solid ${T.danger}`, borderRadius: R.md }}>
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <AlertCircle className="h-8 w-8" style={{ color: T.danger }} />
              <div>
                <p className="font-semibold" style={{ color: T.ink }}>Não foi possível carregar as notificações</p>
                <p className="mt-1 break-words text-sm" style={{ color: T.muted }}>{loadError}</p>
              </div>
              <Button variant="outline" onClick={() => void fetchNotifications()}>Tentar novamente</Button>
            </CardContent>
          </Card>
        )}
        {notifications.map((notification) => (
          <Card
            key={notification.id}
            role="button"
            tabIndex={0}
            aria-pressed={selectedNotification?.id === notification.id}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openNotification(notification); } }}
            style={{ background: selectedNotification?.id === notification.id ? T.g50 : T.white, border: `1px solid ${selectedNotification?.id === notification.id ? T.gBorder : T.rule}`, borderRadius: R.md }}
            className="cursor-pointer overflow-hidden transition-colors hover:border-primary/40"
            onClick={() => void openNotification(notification)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="mt-1 p-2 rounded-full shrink-0" style={{ background: notification.read ? T.canvas : T.white }}>
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm sm:text-base" style={{ color: notification.read ? T.mid : T.ink }}>{getNotificationDisplayTitle(notification.title, notification.type)}</h3>
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

        {!loadError && notifications.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm" style={{ border: `1px solid ${T.rule}` }}><Bell className="h-10 w-10" style={{ color: T.faint }} /></div>
            <p className="font-bold text-lg" style={{ color: T.ink }}>Tudo em dia!</p>
            <p className="text-sm mt-2 max-w-xs mx-auto" style={{ color: T.muted }}>Não tens notificações novas. Avisaremos-te assim que houver novidades sobre os teus produtos ou mensagens.</p>
          </div>
        )}
      </section>
      </div>

      <aside aria-label="Conteúdo da notificação selecionada" className="hidden min-w-0 lg:block">
        <div className="overflow-hidden" style={{ background: T.white, border: `1px solid ${T.rule}`, borderRadius: R.md }}>
          {selectedNotification ? (
            <>
              <div className="border-b p-4 sm:p-5" style={{ borderColor: T.rule }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: T.g600 }}>Acção relacionada</p>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-bold" style={{ color: T.ink }}>{getNotificationDisplayTitle(selectedNotification.title, selectedNotification.type)}</h2>
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: T.muted }}>{selectedNotification.message}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-medium uppercase" style={{ color: T.faint }}>{formatDate(selectedNotification.created_at)}</span>
                </div>
              </div>
              {isProfileTarget ? (
                <div className="flex min-h-[26rem] flex-col items-center justify-center p-8 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: T.g50, color: T.g600 }}><Package className="h-7 w-7" /></div>
                  <h3 className="font-bold" style={{ color: T.ink }}>{profileContext.title}</h3>
                  <p className="mt-2 max-w-sm text-sm" style={{ color: T.muted }}>{profileContext.description}</p>
                  <Button className="mt-5" onClick={() => navigate(selectedTarget ?? '/perfil')}>{profileContext.action}</Button>
                </div>
              ) : selectedTarget && selectedTarget !== '/notificacoes' ? (
                <iframe
                  key={`${selectedNotification.id}:${selectedTarget}`}
                  title={`Conteúdo relacionado: ${getNotificationDisplayTitle(selectedNotification.title, selectedNotification.type)}`}
                  src={selectedTarget}
                  className="h-[65vh] min-h-[26rem] w-full bg-white lg:h-[calc(100vh-13rem)]"
                />
              ) : (
                <div className="flex min-h-[26rem] items-center justify-center p-8 text-center">
                  <div>
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: T.g50, color: T.g600 }}>{getNotificationIcon(selectedNotification.type)}</div>
                    <p className="font-semibold" style={{ color: T.ink }}>Detalhes da notificação</p>
                    <p className="mt-2 max-w-sm text-sm" style={{ color: T.muted }}>Esta notificação não tem uma página de destino associada. O aviso e a sua mensagem estão disponíveis aqui.</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex min-h-[26rem] flex-col items-center justify-center p-8 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: T.g50, color: T.g600 }}><Bell className="h-7 w-7" /></div>
              <p className="font-bold" style={{ color: T.ink }}>As novidades aparecem aqui</p>
              <p className="mt-2 max-w-sm text-sm" style={{ color: T.muted }}>Selecione uma notificação para abrir o produto, a conversa ou a acção relacionada neste painel.</p>
            </div>
          )}
        </div>
      </aside>
      </div>
    </main>
  );
};

export default Notifications;
