import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import usePushNotifications from '@/components/usePushNotifications';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  Heart,
  MessageCircle,
  Package,
  CheckCircle,
  Settings,
  Volume2,
  VolumeX,
  X,
  AlertCircle,
  Zap,
  ArrowLeft,
} from 'lucide-react';
import orbisLinkLogo from '@/assets/orbislink-logo.png';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── AgriLink Design System (Branding T) ─────────────────────── */
const T = {
  /* Greens */
  g900:   '#2c863b',
  g700:   '#1A5C24',
  g600:   '#2D7D3A',
  g500:   '#3D9A48',
  g400:   '#4CAF50',
  g100:   '#E8F5E9',
  g50:    '#F2FAF3',
  gBorder:'#C8E6CA',

  /* Earth */
  e700:   '#5C3317',
  e500:   '#7B4F2E',
  e300:   '#A0522D',
  ePale:  '#FDF5EE',
  eBorder:'#EDD9C6',

  /* Neutrals */
  ink:    '#111714',
  mid:    '#3D4D40',
  muted:  '#758A79',
  faint:  '#A8BAA9',
  canvas: '#F7F9F7',
  white:  '#FFFFFF',
  rule:   '#E5EDE6',

  /* Accents */
  gold:   '#B07D0A',
  goldL:  '#E5A020',

  /* Shadow */
  shadow: 'rgba(13,43,18,0.10)',
  shadowMd:'rgba(13,43,18,0.15)',
}

interface Notification {
  id: string;
  type: 'interest' | 'message' | 'product' | 'system';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  data?: any;
  user_id: string;
}

interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'interest' | 'message' | 'product' | 'system';
  timestamp: number;
}

// --- Gerenciador de Som ---
class SoundManager {
  private audioContext: AudioContext | null = null;
  private isSupported: boolean = true;

  constructor() {
    try {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
    } catch (error) {
      console.warn('AudioContext não suportado:', error);
      this.isSupported = false;
    }
  }

  playChickenSound() {
    if (!this.isSupported || !this.audioContext) {
      this.playFallbackSound();
      return;
    }
    try {
      const ctx = this.audioContext;
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const gain2 = ctx.createGain();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(800, now);
      osc1.frequency.exponentialRampToValueAtTime(400, now + 0.1);
      osc2.frequency.setValueAtTime(1200, now);
      osc2.frequency.exponentialRampToValueAtTime(600, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      gain2.gain.setValueAtTime(0.2, now);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc1.connect(gain);
      osc2.connect(gain2);
      gain.connect(ctx.destination);
      gain2.connect(ctx.destination);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.15);
      osc2.stop(now + 0.15);
      for (let i = 1; i < 3; i++) {
        const osc3 = ctx.createOscillator();
        const osc4 = ctx.createOscillator();
        const g1 = ctx.createGain();
        const g2 = ctx.createGain();
        osc3.type = 'sine';
        osc4.type = 'triangle';
        osc3.frequency.setValueAtTime(800, now + i * 0.2);
        osc3.frequency.exponentialRampToValueAtTime(400, now + i * 0.2 + 0.1);
        osc4.frequency.setValueAtTime(1200, now + i * 0.2);
        osc4.frequency.exponentialRampToValueAtTime(600, now + i * 0.2 + 0.1);
        g1.gain.setValueAtTime(0.3, now + i * 0.2);
        g1.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.15);
        g2.gain.setValueAtTime(0.2, now + i * 0.2);
        g2.gain.exponentialRampToValueAtTime(0.01, now + i * 0.2 + 0.15);
        osc3.connect(g1);
        osc4.connect(g2);
        g1.connect(ctx.destination);
        g2.connect(ctx.destination);
        osc3.start(now + i * 0.2);
        osc4.start(now + i * 0.2);
        osc3.stop(now + i * 0.2 + 0.15);
        osc4.stop(now + i * 0.2 + 0.15);
      }
    } catch (error) {
      console.error('Erro ao reproduzir som:', error);
      this.playFallbackSound();
    }
  }

  playFallbackSound() {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==');
      audio.play().catch(() => {});
    } catch (error) {}
  }
}

// --- Componente Toast de Notificação ---
interface NotificationToastProps {
  notification: ToastNotification;
  onClose: (id: string) => void;
  soundEnabled: boolean;
}

const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onClose,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(notification.id), 6000);
    return () => clearTimeout(timer);
  }, [notification.id, onClose]);

  const getColors = (type: string) => {
    switch (type) {
      case 'interest': return `linear-gradient(135deg, ${T.e700}, ${T.e500})`;
      case 'message': return `linear-gradient(135deg, ${T.g900}, ${T.g600})`;
      case 'product': return `linear-gradient(135deg, ${T.g600}, ${T.g400})`;
      case 'system': return `linear-gradient(135deg, ${T.gold}, ${T.goldL})`;
      default: return `linear-gradient(135deg, ${T.mid}, ${T.muted})`;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'interest': return <Heart className="h-5 w-5" />;
      case 'message': return <MessageCircle className="h-5 w-5" />;
      case 'product': return <Package className="h-5 w-5" />;
      case 'system': return <Zap className="h-5 w-5" />;
      default: return <Bell className="h-5 w-5" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed top-6 right-6 z-[100] max-w-sm w-full"
    >
      <div style={{ background: getColors(notification.type), color: T.white, borderRadius: 16, boxShadow: `0 12px 32px ${T.shadowMd}`, overflow: 'hidden' }}>
        <div className="p-4 flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">{getIcon(notification.type)}</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm">{notification.title}</h3>
            <p className="text-sm opacity-90 mt-1">{notification.message}</p>
          </div>
          <button onClick={() => onClose(notification.id)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <motion.div initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: 6, ease: 'linear' }} className="h-1 bg-white/30 origin-left" />
      </div>
    </motion.div>
  );
};

// --- Componente Principal ---
const Notifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pushNotifications = usePushNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toastNotifications, setToastNotifications] = useState<ToastNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundManagerRef = useRef<SoundManager>(new SoundManager());

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setNotifications(data as Notification[]);
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const playNotificationSound = useCallback(() => {
    if (soundEnabled) soundManagerRef.current.playChickenSound();
  }, [soundEnabled]);

  const showToastNotification = useCallback((notification: Notification) => {
    const toastId = `${notification.id}-${Date.now()}`;
    setToastNotifications((prev) => [...prev, { id: toastId, title: notification.title, message: notification.message, type: notification.type, timestamp: Date.now() }]);
    playNotificationSound();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }, [playNotificationSound]);

  const removeToastNotification = useCallback((id: string) => {
    setToastNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    fetchNotifications();
    if (!user) return;
    const channel = supabase.channel(`user-notifications-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        const newNotif = payload.new as Notification;
        setNotifications((prev) => [newNotif, ...prev]);
        showToastNotification(newNotif);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications, showToastNotification]);

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
      if (error) throw error;
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
      if (error) throw error;
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Erro ao eliminar notificação:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'interest': return <Heart className="h-5 w-5" style={{ color: T.e700 }} />;
      case 'message': return <MessageCircle className="h-5 w-5" style={{ color: T.g900 }} />;
      case 'product': return <Package className="h-5 w-5" style={{ color: T.g600 }} />;
      case 'system': return <Zap className="h-5 w-5" style={{ color: T.gold }} />;
      default: return <Bell className="h-5 w-5" style={{ color: T.muted }} />;
    }
  };

  const getNotificationColor = (notification: Notification) => {
    if (!notification.read) return { background: T.g50, border: `1px solid ${T.gBorder}` };
    return { background: T.white, border: `1px solid ${T.rule}` };
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('pt-BR');
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.canvas }}>
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4" style={{ color: T.g900 }} />
          <p style={{ color: T.muted }}>Carregando notificações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: T.canvas }}>
      <AnimatePresence>
        {toastNotifications.map((toast) => (
          <NotificationToast key={toast.id} notification={toast} onClose={removeToastNotification} soundEnabled={soundEnabled} />
        ))}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-50" style={{ background: T.white, borderBottom: `1px solid ${T.rule}`, boxShadow: `0 2px 8px ${T.shadow}` }}>
        <div className="px-4 py-4 flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} style={{ color: T.mid }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold" style={{ color: T.ink }}>Notificações</h1>
            {unreadCount > 0 && (
              <Badge style={{ background: T.g900, color: T.white }}>{unreadCount}</Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setSoundEnabled(!soundEnabled)} style={{ color: soundEnabled ? T.g900 : T.faint }}>
              {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </Button>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead} style={{ color: T.g900, fontSize: '12px' }}>
                Marcar todas
              </Button>
            )}
            <Button variant="ghost" size="icon" style={{ color: T.mid }}>
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Push Notification Banner */}
      {pushNotifications.isSupported && !pushNotifications.isSubscribed && (
        <div className="max-w-3xl mx-auto px-4 pt-4">
          <Card style={{ background: `linear-gradient(135deg, ${T.g900}, ${T.g600})`, border: 'none', borderRadius: 16 }} className="overflow-hidden">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <Bell className="h-5 w-5" style={{ color: T.white }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm" style={{ color: T.white }}>Activar Notificações Push</h3>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  Receba alertas mesmo quando o browser estiver fechado.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => pushNotifications.subscribe()}
                disabled={pushNotifications.isLoading}
                style={{ background: T.white, color: T.g900, fontWeight: 700, fontSize: 12, borderRadius: 10 }}
              >
                Activar
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
            <button
              onClick={() => pushNotifications.unsubscribe()}
              className="ml-auto text-xs underline"
              style={{ color: T.muted }}
            >
              Desactivar
            </button>
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

      {/* Lista de Notificações */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <AnimatePresence>
          {notifications.map((notification) => (
            <motion.div key={notification.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
              <Card
                style={getNotificationColor(notification)}
                className="cursor-pointer transition-all hover:shadow-md overflow-hidden"
                onClick={() => markAsRead(notification.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 p-2 rounded-full" style={{ background: notification.read ? T.canvas : T.white }}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-sm sm:text-base" style={{ color: notification.read ? T.mid : T.ink }}>
                          {notification.title}
                        </h3>
                        <span className="text-[10px] uppercase tracking-wider font-medium" style={{ color: T.faint }}>
                          {formatDate(notification.created_at)}
                        </span>
                      </div>
                      <p className="text-sm mt-1 leading-relaxed" style={{ color: T.muted }}>
                        {notification.message}
                      </p>
                      {!notification.read && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: T.g900 }} />
                          <span className="text-[10px] font-bold uppercase" style={{ color: T.g900 }}>Nova</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                      className="p-1 hover:bg-black/5 rounded-full transition-colors"
                    >
                      <X className="h-4 w-4" style={{ color: T.faint }} />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {notifications.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm" style={{ border: `1px solid ${T.rule}` }}>
              <Bell className="h-10 w-10" style={{ color: T.faint }} />
            </div>
            <p className="font-bold text-lg" style={{ color: T.ink }}>Tudo em dia!</p>
            <p className="text-sm mt-2 max-w-xs mx-auto" style={{ color: T.muted }}>
              Não tens notificações novas. Avisaremos-te assim que houver novidades sobre os teus produtos ou mensagens.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const Loader2 = ({ className, style }: { className?: string, style?: React.CSSProperties }) => (
  <svg className={className} style={style} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export default Notifications;
