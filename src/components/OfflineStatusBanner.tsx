import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { countPendingOfflineInserts, flushOfflineInserts } from '../lib/offlineMutationQueue';

export default function OfflineStatusBanner() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [restored, setRestored] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const refreshQueue = useCallback(async (activeUserId: string | null) => {
    if (!activeUserId) {
      setPendingCount(0);
      return;
    }
    try {
      setPendingCount(await countPendingOfflineInserts(activeUserId));
    } catch (error) {
      console.warn('[AgriLink] Não foi possível consultar a fila offline.', error);
    }
  }, []);

  const syncQueue = useCallback(async () => {
    if (!navigator.onLine || !userId) return;
    setSyncing(true);
    try {
      const result = await flushOfflineInserts(userId);
      setPendingCount(result.remaining);
    } catch (error) {
      console.warn('[AgriLink] A sincronização offline será repetida mais tarde.', error);
    } finally {
      setSyncing(false);
    }
  }, [userId]);

  useEffect(() => {
    let active = true;
    const applySession = (nextUserId: string | null) => {
      if (!active) return;
      setUserId(nextUserId);
      void refreshQueue(nextUserId);
    };
    void supabase.auth.getSession().then(({ data }) => applySession(data.session?.user.id ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session?.user.id ?? null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [refreshQueue]);

  useEffect(() => {
    const handleOffline = () => {
      setOnline(false);
      setRestored(false);
    };
    const handleOnline = () => {
      setOnline(true);
      setRestored(true);
      void syncQueue();
      const timeout = window.setTimeout(() => setRestored(false), 6000);
      return () => window.clearTimeout(timeout);
    };
    const handleQueueChanged = () => {
      void refreshQueue(userId);
      if (navigator.onLine) void syncQueue();
    };
    const handleFocus = () => {
      void refreshQueue(userId);
      if (navigator.onLine) void syncQueue();
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('agrilink:offline-queue-changed', handleQueueChanged);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('agrilink:offline-queue-changed', handleQueueChanged);
    };
  }, [refreshQueue, syncQueue, userId]);

  if (online && !restored && pendingCount === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        padding: '9px 14px',
        textAlign: 'center',
        fontSize: 13,
        fontWeight: 600,
        color: online ? '#173b24' : '#fff',
        background: online ? '#d8f3df' : '#8b2f20',
        boxShadow: '0 2px 8px rgba(0,0,0,.12)',
      }}
    >
      {!online
        ? 'Sem internet. O AgriLink mantém recursos e operações offline suportadas neste dispositivo.'
        : syncing
          ? 'A sincronizar alterações offline com a AgriLink…'
          : pendingCount > 0
            ? `${pendingCount} operação(ões) aguardam sincronização. Mantém a sessão iniciada e a ligação ativa.`
            : restored
              ? 'Ligação restaurada. As operações offline suportadas foram verificadas para sincronização.'
              : null}
    </div>
  );
}
