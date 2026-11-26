import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import usePushNotifications from '../components/usePushNotifications';
import { Badge } from '../components/ui/badge';
import {
  Bell,
  BellOff,
  Heart,
  MessageCircle,
  Package,
  CheckCircle,
  CheckCheck,
  ExternalLink,
  Trash2,
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

type Filter = 'all' | 'unread';

const TYPE_LABELS: Record<string, string> = {
  interest: 'Interesse',
  reaction: 'Reacção',
  message: 'Mensagem',
  product: 'Produto',
  pre_order_received: 'Pré-compra recebida',
  pre_order_accepted: 'Pré-compra',
  system: 'Sistema',
  referral: 'Indicação',
};

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/** Agrupa por dia para a lista ficar legível: Hoje, Ontem, Esta semana, Anteriores. */
function getGroupLabel(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(date) === dayKey(today)) return 'Hoje';
  if (dayKey(date) === dayKey(yesterday)) return 'Ontem';
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return (startOfToday - startOfDate) / 86400000 < 7 ? 'Esta semana' : 'Anteriores';
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
  const [filter, setFilter] = useState<Filter>('all');
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
      setSelectedId((current) => (current === id ? null : current));
      toast.success('Notificação eliminada.');
    } catch (error) {
      console.error('Erro ao eliminar notificação:', error);
      toast.error('Não foi possível eliminar a notificação.');
    }
  }, [userId]);

  const getNotificationIcon = (type: string, size = 'h-5 w-5') => {
    switch (type) {
      case 'interest': case 'reaction': return <Heart className={size} style={{ color: T.e700 }} />;
      case 'message': return <MessageCircle className={size} style={{ color: T.g900 }} />;
      case 'product': case 'pre_order_accepted': return <Package className={size} style={{ color: T.g600 }} />;
      case 'system': case 'referral': return <Zap className={size} style={{ color: T.gold }} />;
      default: return <Bell className={size} style={{ color: T.muted }} />;
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

  // Na vista "Não lidas" mantemos a notificação aberta, para não desaparecer ao ser marcada como lida.
  const visible = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => !n.read || n.id === selectedId) : notifications),
    [notifications, filter, selectedId],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Notification[]>();
    for (const notification of visible) {
      const label = getGroupLabel(notification.created_at);
      const bucket = map.get(label);
      if (bucket) bucket.push(notification);
      else map.set(label, [notification]);
    }
    return Array.from(map.entries());
  }, [visible]);

  const selectedNotification = notifications.find((notification) => notification.id === selectedId) ?? visible[0] ?? null;
  const selectedTarget = selectedNotification ? getNotificationTargetPath(selectedNotification) : null;
  const isProfileTarget = Boolean(selectedTarget?.startsWith('/perfil'));
  const hasEmbeddedTarget = Boolean(selectedTarget && selectedTarget !== '/notificacoes' && !isProfileTarget);
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

  const pushDenied = pushNotifications.isSupported && !pushNotifications.isSubscribed && typeof Notification !== 'undefined' && Notification.permission === 'denied';
  const pushCanSubscribe = pushNotifications.isSupported && !pushNotifications.isSubscribed && typeof Notification !== 'undefined' && Notification.permission !== 'denied';

  return (
    <main className="min-h-screen pb-28" style={{ background: T.canvas, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <header className="sticky top-0 z-30" style={{ background: T.white, borderBottom: `1px solid ${T.rule}` }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => navigate(-1)} style={{ color: T.mid, borderRadius: R.md }}><ArrowLeft className="h-5 w-5" /></Button>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: T.g600 }}>AgriLink</p>
              <h1 className="truncate text-xl font-bold leading-tight" style={{ color: T.ink }}>Notificações</h1>
            </div>
            {unreadCount > 0 && <Badge style={{ background: T.g50, color: T.g900, borderRadius: R.pill }}>{unreadCount} nova{unreadCount === 1 ? '' : 's'}</Badge>}
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="shrink-0 gap-1.5" style={{ color: T.g900, fontSize: 12, borderRadius: R.md, borderColor: T.rule }}>
              <CheckCheck className="h-4 w-4" /> <span className="hidden sm:inline">Marcar todas como lidas</span><span className="sm:hidden">Marcar todas</span>
            </Button>
          )}
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(19rem,0.82fr)_minmax(0,1.18fr)]">
        {/* ═══ Coluna esquerda: estado do push + lista ═══ */}
        <div className="min-w-0 space-y-4">
          {!pushNotifications.isSupported && pushNotifications.supportMessage && (
            <Card style={{ background: T.white, border: `1px solid ${T.rule}`, borderRadius: R.md }}>
              <CardContent className="flex items-start gap-3 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: T.gold }} />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold" style={{ color: T.ink }}>Configurar notificações neste dispositivo</h3>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: T.muted }}>{pushNotifications.supportMessage}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {pushDenied && (
            <Card role="status" style={{ background: T.white, border: `1px solid ${T.goldBorder}`, borderRadius: R.md }}>
              <CardContent className="flex items-start gap-3 p-4">
                <BellOff className="mt-0.5 h-5 w-5 shrink-0" style={{ color: T.gold }} />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold" style={{ color: T.ink }}>Notificações bloqueadas neste navegador</h3>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: T.muted }}>Nas definições do navegador, permita notificações para este site e recarregue a página. Enquanto isso, as notificações continuam disponíveis aqui.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {pushCanSubscribe && (
            <Card style={{ background: `linear-gradient(135deg, ${T.g900}, ${T.g600})`, border: 'none', borderRadius: R.md }}>
              <CardContent className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap sm:gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }}><Bell className="h-5 w-5 text-white" /></div>
                <div className="min-w-0 flex-1 basis-40">
                  <h3 className="text-sm font-bold text-white">Activar notificações push</h3>
                  <p className="mt-0.5 text-xs text-white/75">Receba alertas mesmo quando a aplicação não estiver aberta.</p>
                </div>
                <Button size="sm" onClick={() => void pushNotifications.subscribe()} disabled={pushNotifications.isLoading} style={{ background: T.white, color: T.g900, fontWeight: 700, fontSize: 12, borderRadius: R.sm }}>
                  {pushNotifications.isLoading ? 'A activar…' : 'Activar'}
                </Button>
              </CardContent>
            </Card>
          )}

          {pushNotifications.isSupported && pushNotifications.isSubscribed && (
            <div className="flex items-center gap-2 p-3" style={{ background: T.g50, border: `1px solid ${T.gBorder}`, borderRadius: R.md }}>
              <CheckCircle className="h-4 w-4" style={{ color: T.g900 }} />
              <span className="text-xs font-semibold" style={{ color: T.g900 }}>Notificações push activas</span>
              <button type="button" onClick={() => void pushNotifications.unsubscribe()} className="ml-auto text-xs underline" style={{ color: T.muted }}>Desactivar</button>
            </div>
          )}

          {pushNotifications.error && (
            <div role="alert" className="flex items-center gap-2 p-3" style={{ background: T.dangerBg, border: `1px solid ${T.danger}`, borderRadius: R.md }}>
              <AlertCircle className="h-4 w-4 shrink-0" style={{ color: T.danger }} />
              <span className="text-xs" style={{ color: T.danger }}>{pushNotifications.error}</span>
            </div>
          )}

          {/* Filtro */}
          {notifications.length > 0 && (
            <div role="tablist" aria-label="Filtrar notificações" className="flex gap-1 p-1" style={{ background: T.white, border: `1px solid ${T.rule}`, borderRadius: R.md }}>
              {([
                { id: 'all' as Filter, label: 'Todas', count: notifications.length },
                { id: 'unread' as Filter, label: 'Não lidas', count: unreadCount },
              ]).map((tab) => {
                const active = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(tab.id)}
                    className="flex flex-1 items-center justify-center gap-2 px-3 py-2 text-sm font-semibold transition-colors"
                    style={{ background: active ? T.g50 : 'transparent', color: active ? T.g900 : T.muted, borderRadius: R.md }}
                  >
                    {tab.label}
                    <span className="min-w-[1.25rem] rounded-full px-1.5 text-center text-[11px] font-bold tabular-nums" style={{ background: active ? T.white : T.canvas, color: active ? T.g900 : T.faint }}>{tab.count}</span>
                  </button>
                );
              })}
            </div>
          )}

          <section aria-label="Lista de notificações" className="space-y-5">
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

            {groups.map(([label, items]) => (
              <div key={label}>
                <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: T.faint }}>{label}</h2>
                <div className="overflow-hidden" style={{ background: T.white, border: `1px solid ${T.rule}`, borderRadius: R.md }}>
                  {items.map((notification, index) => {
                    const isSelected = selectedNotification?.id === notification.id;
                    return (
                      <div
                        key={notification.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openNotification(notification); } }}
                        onClick={() => void openNotification(notification)}
                        className="group relative flex cursor-pointer items-start gap-3 p-4 transition-colors hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                        style={{ background: isSelected ? T.g50 : T.white, borderTop: index === 0 ? 'none' : `1px solid ${T.rule}` }}
                      >
                        {!notification.read && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px]" style={{ background: T.g600 }} />}
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: notification.read ? T.canvas : T.g50 }}>
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="min-w-0 text-sm font-bold leading-snug sm:text-[15px]" style={{ color: notification.read ? T.mid : T.ink }}>
                              {getNotificationDisplayTitle(notification.title, notification.type)}
                              {!notification.read && <span className="sr-only"> (nova)</span>}
                            </h3>
                            <span className="shrink-0 pt-0.5 text-[10px] font-medium uppercase tracking-wider tabular-nums" style={{ color: T.faint }}>{formatDate(notification.created_at)}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed" style={{ color: T.muted }}>{notification.message}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void deleteNotification(notification.id); }}
                          className="shrink-0 rounded-full p-1.5 transition-opacity hover:bg-black/5 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                          aria-label="Eliminar notificação"
                        >
                          <X className="h-4 w-4" style={{ color: T.faint }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {!loadError && notifications.length === 0 && (
              <div className="py-20 text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full" style={{ background: T.white, border: `1px solid ${T.rule}` }}><Bell className="h-10 w-10" style={{ color: T.faint }} /></div>
                <p className="text-lg font-bold" style={{ color: T.ink }}>Tudo em dia!</p>
                <p className="mx-auto mt-2 max-w-xs text-sm" style={{ color: T.muted }}>Não tens notificações novas. Avisaremos-te assim que houver novidades sobre os teus produtos ou mensagens.</p>
              </div>
            )}

            {!loadError && notifications.length > 0 && visible.length === 0 && (
              <div className="py-14 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: T.g50, color: T.g600 }}><CheckCheck className="h-7 w-7" /></div>
                <p className="font-bold" style={{ color: T.ink }}>Sem notificações por ler</p>
                <button type="button" onClick={() => setFilter('all')} className="mt-2 text-sm font-semibold underline" style={{ color: T.g900 }}>Ver todas</button>
              </div>
            )}
          </section>
        </div>

        {/* ═══ Coluna direita: detalhe (só em ecrãs largos) ═══ */}
        <aside aria-label="Conteúdo da notificação selecionada" className="hidden min-w-0 lg:block">
          <div className="sticky top-24 overflow-hidden" style={{ background: T.white, border: `1px solid ${T.rule}`, borderRadius: R.md }}>
            {selectedNotification ? (
              <>
                <div className="border-b p-5" style={{ borderColor: T.rule }}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: T.g50 }}>
                      {getNotificationIcon(selectedNotification.type, 'h-5 w-5')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold uppercase tracking-[0.1em]">
                        <span style={{ color: T.g600 }}>{TYPE_LABELS[selectedNotification.type] ?? 'Aviso'}</span>
                        <span aria-hidden="true" style={{ color: T.faint }}>·</span>
                        <time className="font-medium normal-case tracking-normal" dateTime={selectedNotification.created_at} style={{ color: T.faint }}>
                          {new Date(selectedNotification.created_at).toLocaleString('pt-AO', { dateStyle: 'medium', timeStyle: 'short' })}
                        </time>
                      </div>
                      <h2 className="mt-1.5 text-lg font-bold leading-snug" style={{ color: T.ink }}>{getNotificationDisplayTitle(selectedNotification.title, selectedNotification.type)}</h2>
                      <p className="mt-1.5 text-sm leading-relaxed" style={{ color: T.muted }}>{selectedNotification.message}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {hasEmbeddedTarget && selectedTarget && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(selectedTarget)} style={{ borderRadius: R.md, borderColor: T.rule }}>
                        <ExternalLink className="h-4 w-4" /> Abrir em página inteira
                      </Button>
                    )}
                    {!selectedNotification.read && (
                      <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => void markAsRead(selectedNotification.id)} style={{ borderRadius: R.md, color: T.g900 }}>
                        <CheckCircle className="h-4 w-4" /> Marcar como lida
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="ml-auto gap-1.5" onClick={() => void deleteNotification(selectedNotification.id)} style={{ borderRadius: R.md, color: T.muted }}>
                      <Trash2 className="h-4 w-4" /> Eliminar
                    </Button>
                  </div>
                </div>

                {isProfileTarget ? (
                  <div className="flex min-h-[22rem] flex-col items-center justify-center p-8 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: T.g50, color: T.g600 }}><Package className="h-7 w-7" /></div>
                    <h3 className="font-bold" style={{ color: T.ink }}>{profileContext.title}</h3>
                    <p className="mt-2 max-w-sm text-sm" style={{ color: T.muted }}>{profileContext.description}</p>
                    <Button className="mt-5" onClick={() => navigate(selectedTarget ?? '/perfil')}>{profileContext.action}</Button>
                  </div>
                ) : hasEmbeddedTarget && selectedTarget ? (
                  <iframe
                    key={`${selectedNotification.id}:${selectedTarget}`}
                    title={`Conteúdo relacionado: ${getNotificationDisplayTitle(selectedNotification.title, selectedNotification.type)}`}
                    src={selectedTarget}
                    className="h-[65vh] min-h-[22rem] w-full bg-white lg:h-[calc(100vh-21rem)]"
                  />
                ) : (
                  <div className="flex min-h-[18rem] items-center justify-center p-8 text-center">
                    <div>
                      <p className="font-semibold" style={{ color: T.ink }}>Sem página associada</p>
                      <p className="mt-2 max-w-sm text-sm" style={{ color: T.muted }}>Esta notificação não tem uma página de destino. O aviso e a sua mensagem estão disponíveis acima.</p>
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