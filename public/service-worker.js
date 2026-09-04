const CACHE_NAME = 'agrilink-shell-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/placeholder.svg',
  '/robots.txt'
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando cache shell...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Ativando cache do AgriLink...');
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match('/index.html');
          return cachedResponse || caches.match('/');
        })
    );
    return;
  }

  if (request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request)
          .then((response) => {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
            return response;
          })
          .catch(() => caches.match('/index.html'));
      })
    );
  }
});

self.addEventListener('message', (event) => {
  console.log('[Service Worker] Mensagem recebida:', event.data);
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push recebido:', event);

  let notificationData = {
    title: 'Notificação AgriLink',
    body: 'Você tem uma nova notificação',
    icon: '/placeholder.svg',
    badge: '/placeholder.svg',
    tag: 'agrilink-notification',
    data: {},
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'close', title: 'Fechar' }
    ],
    requireInteraction: true,
    vibrate: [200, 100, 200],
    silent: false
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = { ...notificationData, ...data };
    } catch (e) {
      console.error('[Service Worker] Erro ao parsear dados:', e);
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(notificationData.title, notificationData),
      notificationData.sound ? playNotificationSound(notificationData.sound) : Promise.resolve()
    ])
  );
});

async function playNotificationSound(soundUrl) {
  try {
    const audioContext = new AudioContext();
    const response = await fetch(soundUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start(0);

    return new Promise((resolve) => {
      source.onended = resolve;
    });
  } catch (error) {
    console.error('[Service Worker] Erro ao tocar som:', error);
  }
}

self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notificação clicada:', event);
  event.notification.close();

  if (event.action === 'close') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === self.location.origin + '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('[Service Worker] Notificação fechada:', event);
});
