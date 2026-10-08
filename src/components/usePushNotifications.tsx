import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../integrations/supabase/client';

interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface UsePushNotificationsReturn {
  isSupported: boolean;
  supportMessage: string | null;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

/**
 * Hook para gerenciar Web Push Notifications
 * Suporta notificações mesmo quando o usuário está offline
 */
export const usePushNotifications = (): UsePushNotificationsReturn => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [supportMessage, setSupportMessage] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detectar suporte real, incluindo a exigência de instalação no ecrã principal do iOS.
  useEffect(() => {
    const hasPushApis =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    const isSecure = window.isSecureContext;
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/i.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const iosNeedsInstall = isIOS && !isStandalone;
    const supported = hasPushApis && isSecure && !iosNeedsInstall;

    setIsSupported(supported);
    if (!isSecure) {
      setSupportMessage('As notificações push exigem HTTPS. Abra a AgriLink pelo endereço seguro https://www.agrilink.ao.');
    } else if (iosNeedsInstall) {
      setSupportMessage('No iPhone/iPad, abra a AgriLink no Safari, toque em Partilhar e escolha “Adicionar ao ecrã principal”. Depois, abra a aplicação pelo novo ícone e active as notificações.');
    } else if (!hasPushApis) {
      setSupportMessage('Este navegador não disponibiliza notificações push. Actualize o navegador ou experimente Chrome/Edge no Android/desktop ou Safari numa versão compatível.');
    } else {
      setSupportMessage(null);
    }
    setIsLoading(false);
  }, []);

  // Confirmar a subscrição local E sincronizá-la com o servidor para a conta actual.
  useEffect(() => {
    let cancelled = false;

    const checkSubscription = async () => {
      if (!isSupported || !user?.id) {
        setIsSubscribed(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          if (!cancelled) setIsSubscribed(false);
          return;
        }

        const configuredKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!configuredKey) {
          if (!cancelled) {
            setIsSubscribed(false);
            setError('A chave pública VAPID não está configurada neste deployment; não é possível confirmar a entrega push.');
          }
          return;
        }

        const expectedKey = urlBase64ToUint8Array(configuredKey);
        if (!arePushKeysEqual(subscription.options.applicationServerKey, expectedKey)) {
          const { error: deleteError } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', subscription.endpoint);
          if (deleteError) throw deleteError;
          await subscription.unsubscribe();
          if (!cancelled) {
            setIsSubscribed(false);
            setError('A chave de notificações foi actualizada. Active novamente as notificações para registar este dispositivo.');
          }
          return;
        }

        const subscriptionJSON = subscription.toJSON() as PushSubscriptionJSON;
        const { error: registerError } = await supabase.rpc('register_push_subscription', {
          p_endpoint: subscriptionJSON.endpoint,
          p_auth_key: subscriptionJSON.keys.auth,
          p_p256dh_key: subscriptionJSON.keys.p256dh,
        });
        if (registerError) throw registerError;

        if (!cancelled) {
          setError(null);
          setIsSubscribed(true);
        }
      } catch (err) {
        console.error('Erro ao validar/registar subscrição:', err);
        if (!cancelled) {
          setIsSubscribed(false);
          setError('Não foi possível confirmar o registo deste dispositivo no servidor. Tente activar novamente as notificações.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void checkSubscription();
    return () => { cancelled = true; };
  }, [isSupported, user?.id]);

  // Subscrever a notificações push
  const subscribe = useCallback(async () => {
    if (!isSupported || !user) {
      setError('Push Notifications não suportadas ou usuário não autenticado');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Pedir permissão
      if (Notification.permission === 'denied') {
        setError('Permissão para notificações foi negada');
        setIsLoading(false);
        return;
      }

      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setError('Permissão para notificações foi negada');
          setIsLoading(false);
          return;
        }
      }

      // Obter Service Worker
      const registration = await navigator.serviceWorker.ready;

      // Chave pública VAPID (gerar em seu servidor)
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

      if (!vapidPublicKey) {
        setError('Chave VAPID não configurada');
        setIsLoading(false);
        return;
      }

      // A chave VAPID pública é a chave P-256 codificada em base64url.
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
      if (convertedVapidKey.byteLength !== 65 || convertedVapidKey[0] !== 4) {
        throw new Error('Chave VAPID pública inválida. Deve ser uma chave P-256 base64url de 65 bytes e corresponder à chave privada do servidor.');
      }

      // Reutilizar a subscrição se já estiver vinculada à chave actual.
      let subscription = await registration.pushManager.getSubscription();
      if (subscription && !arePushKeysEqual(subscription.options.applicationServerKey, convertedVapidKey)) {
        // Primeiro remover o registo do servidor; só depois invalidar a subscrição local.
        const { error: deleteError } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);
        if (deleteError) throw deleteError;
        await subscription.unsubscribe();
        subscription = null;
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey as BufferSource,
        });
      }

      // Guardar a subscrição associada ao utilizador e ao endpoint deste dispositivo.
      const subscriptionJSON = subscription.toJSON() as PushSubscriptionJSON;

      const { error: dbError } = await supabase.rpc('register_push_subscription', {
        p_endpoint: subscriptionJSON.endpoint,
        p_auth_key: subscriptionJSON.keys.auth,
        p_p256dh_key: subscriptionJSON.keys.p256dh,
      });

      if (dbError) throw dbError;

      setIsSubscribed(true);
      console.log('Subscrito a notificações push com sucesso');
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Erro ao subscrever';
      const errorMessage = /applicationServerKey|VAPID|InvalidAccessError/i.test(raw)
        ? 'Não foi possível activar as notificações. Verifique se VITE_VAPID_PUBLIC_KEY corresponde à VAPID_PUBLIC_KEY configurada no servidor.'
        : raw;
      setError(errorMessage);
      console.error('Erro ao subscrever:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user]);

  // Desinscrever de notificações push
  const unsubscribe = useCallback(async () => {
    if (!isSupported || !user) return;

    setIsLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Remover do banco de dados
        const { error: deleteError } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);
        if (deleteError) throw deleteError;

        setIsSubscribed(false);
        console.log('Desinscrição de notificações push com sucesso');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao desinscrever';
      setError(errorMessage);
      console.error('Erro ao desinscrever:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user]);


  return {
    isSupported,
    supportMessage,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  };
};

function arePushKeysEqual(
  currentKey: ArrayBuffer | ArrayBufferView | null,
  expectedKey: Uint8Array,
): boolean {
  if (!currentKey) return false;
  const currentBytes = currentKey instanceof ArrayBuffer
    ? new Uint8Array(currentKey)
    : new Uint8Array(currentKey.buffer, currentKey.byteOffset, currentKey.byteLength);
  if (currentBytes.length !== expectedKey.length) return false;
  return currentBytes.every((byte, index) => byte === expectedKey[index]);
}

/**
 * Converter URL Base64 para Uint8Array
 * Necessário para converter chave VAPID
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default usePushNotifications;