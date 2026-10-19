import { useEffect, useState } from 'react';

export default function OfflineStatusBanner() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setOnline(false);
      setRestored(false);
    };
    const handleOnline = () => {
      setOnline(true);
      setRestored(true);
      const timeout = window.setTimeout(() => setRestored(false), 6000);
      return () => window.clearTimeout(timeout);
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (online && !restored) return null;

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
      {online
        ? 'Ligação à internet restaurada. As operações pendentes só ficam sincronizadas quando forem guardadas na fila offline da funcionalidade.'
        : 'Sem internet. O AgriLink pode abrir recursos já guardados; confirme a sincronização das alterações quando a ligação voltar.'}
    </div>
  );
}
