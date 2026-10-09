const CACHE_NAME = 'agrilink-shell-v9';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/robots.txt'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('agrilink-') && key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // Navegação: sempre rede primeiro (evita servir HTML antigo com scripts inexistentes)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Só guardar páginas válidas; não substituir o shell offline por erros HTTP.
          if (response.ok && response.type === 'basic' && !response.headers.get('Cache-Control')?.toLowerCase().includes('no-store')) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy)));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match('/index.html')) || cache.match('/');
        })
    );
    return;
  }

  // Pedidos de dados (fetch/XHR, APIs e respostas sem destino estático) nunca são colocados em cache.
  // Isto evita persistir respostas potencialmente privadas no cache partilhado da origem.
  if (request.destination === '') return;

  // Scripts/estilos: rede primeiro, cache apenas como fallback offline.
  // Nunca devolver HTML para pedidos de assets (causava ecrã branco).
  if (request.destination === 'script' || request.destination === 'style' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic' && !response.headers.get('Cache-Control')?.toLowerCase().includes('no-store')) {
            const cloned = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned)));
          }
          return response;
        })
        .catch(async () => (await caches.open(CACHE_NAME)).match(request))
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => cache.match(request)).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic' && !response.headers.get('Cache-Control')?.toLowerCase().includes('no-store')) {
            const cloned = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned)));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});


self.addEventListener('message', (event) => {
  console.log('[Service Worker] Mensagem recebida:', event.data);
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'Notificação AgriLink',
    body: 'Você tem uma nova notificação',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'agrilink-notification',
    data: {},
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'close', title: 'Fechar' }
    ],
    requireInteraction: false,
    renotify: true,
    vibrate: [200, 100, 200],
    silent: false
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = { ...notificationData, ...data };
    } catch {
      notificationData.body = event.data.text();
    }
  }

  const eventId = notificationData?.data?.notification_id || notificationData?.data?.id || crypto.randomUUID();
  notificationData.tag = 'agrilink-' + eventId;

  // Se a aplicação estiver visível, encaminhar o push para o runtime da página.
  // Assim evitamos duplicar o toast/som em primeiro plano com uma notificação do sistema.
  // Em segundo plano, o sistema operativo apresenta a notificação push normalmente.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const activeClients = clients.filter((client) => client.visibilityState === 'visible' && client.focused);
      if (activeClients.length > 0) {
        activeClients.forEach((client) => client.postMessage({
          type: 'PUSH_NOTIFICATION',
          notification: {
            id: notificationData?.data?.notification_id || notificationData?.data?.id,
            title: notificationData.title,
            message: notificationData.body,
            type: notificationData?.data?.type || 'system',
            metadata: notificationData?.data || {},
          },
        }));
        return;
      }
      // O som/vibração em segundo plano é controlado pelo navegador e pelo sistema operativo.
      return self.registration.showNotification(notificationData.title, notificationData);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notificação clicada:', event);
  event.notification.close();

  if (event.action === 'close') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const targetPath = event.notification?.data?.path;
      let targetUrl = self.location.origin + '/notificacoes';
      if (typeof targetPath === 'string' && targetPath.startsWith('/') && !targetPath.startsWith('//') && !targetPath.includes('\\\\')) {
        try {
          const parsedTarget = new URL(targetPath, self.location.origin);
          if (parsedTarget.origin === self.location.origin) targetUrl = parsedTarget.toString();
        } catch {
          // Mantém o destino interno seguro quando o caminho recebido é inválido.
        }
      }
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) return client.focus();
      }
      for (const client of clientList) {
        if ('focus' in client && client.url.startsWith(self.location.origin)) {
          if (targetUrl && 'navigate' in client) {
            return client.navigate(targetUrl).then(() => client.focus());
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notificação fechada:', event);
});
