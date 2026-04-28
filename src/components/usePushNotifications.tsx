import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface UsePushNotificationsReturn {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  sendTestNotification: () => Promise<void>;
}

/**
 * Hook para gerenciar Web Push Notifications
 * Suporta notificações mesmo quando o usuário está offline
 */
export const usePushNotifications = (): UsePushNotificationsReturn => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verificar suporte
  useEffect(() => {
    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    setIsSupported(supported);
    setIsLoading(false);

    if (!supported) {
      console.warn('Push Notifications não suportadas neste navegador');
    }
  }, []);

  // Verificar se já está subscrito
  useEffect(() => {
    if (!isSupported || !user) return;

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch (err) {
        console.error('Erro ao verificar subscrição:', err);
      }
    };

    checkSubscription();
  }, [isSupported, user]);

  // Converter ArrayBuffer para Base64
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

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

      // Converter chave VAPID
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      // Subscrever
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as BufferSource,
      });

      // Salvar subscrição no banco de dados
      const subscriptionJSON = subscription.toJSON() as PushSubscriptionJSON;

      const { error: dbError } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscriptionJSON.endpoint,
          auth_key: subscriptionJSON.keys.auth,
          p256dh_key: subscriptionJSON.keys.p256dh,
          updated_at: new Date().toISOString(),
        });

      if (dbError) throw dbError;

      setIsSubscribed(true);
      console.log('Subscrito a notificações push com sucesso');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao subscrever';
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
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id);

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

  // Enviar notificação de teste
  const sendTestNotification = useCallback(async () => {
    if (!isSupported || !user) {
      setError('Não é possível enviar notificação de teste');
      return;
    }

    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          title: 'Notificação de Teste',
          message: 'Esta é uma notificação de teste do Agri Link',
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao enviar notificação de teste');
      }

      console.log('Notificação de teste enviada com sucesso');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao enviar teste';
      setError(errorMessage);
      console.error('Erro ao enviar notificação de teste:', err);
    }
  }, [isSupported, user]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    sendTestNotification,
  };
};

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