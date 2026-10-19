const CACHE_NAME = 'agrilink-shell-v11';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.ico', '/robots.txt'];
const PRIVATE_OR_API_PATH = /\/(?:rest\/v1|auth\/v1|functions\/v1|storage\/v1|realtime\/v1)(?:\/|$)/i;

async function cacheIfSafe(cache, request, response) {
  if (!response || !response.ok || response.type !== 'basic') return;
  const cacheControl = response.headers.get('Cache-Control') || '';
  if (/(?:^|,)\s*(?:no-store|no-cache|private)\b/i.test(cacheControl)) return;
  await cache.put(request, response.clone());
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async (url) => {
      const critical = url === '/' || url === '/index.html';
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (!response.ok || response.type !== 'basic') {
          if (critical) throw new Error(`Não foi possível preparar o shell offline: ${url}`);
          return;
        }
        const cacheControl = response.headers.get('Cache-Control') || '';
        if (/(?:^|,)\\s*no-store\\b/i.test(cacheControl)) {
          if (critical) throw new Error(`O shell da aplicação não pode ser guardado offline: ${url}`);
          return;
        }
        if (critical) {
          // O HTML é um recurso estático da aplicação; guardamo-lo como fallback
          // mesmo quando exige revalidação online, para manter o shell acessível offline.
          await cache.put(url, response.clone());
        } else {
          await cacheIfSafe(cache, url, response);
        }
      } catch (error) {
        if (critical) throw error;
      }
    }));

    // O manifesto e todos os chunks emitidos pelo build são obrigatórios para
    // activar a nova versão. Se algum recurso falhar, a instalação aborta e a
    // versão anterior continua activa em vez de apagar a cache funcional.
    const manifestResponse = await fetch('/precache-manifest.json', { cache: 'no-store' });
    if (!manifestResponse.ok) throw new Error('O manifesto de recursos offline não está disponível.');
    const assets = await manifestResponse.json();
    if (!Array.isArray(assets)) throw new Error('O manifesto de recursos offline é inválido.');
    await Promise.all(assets.map(async (url) => {
      if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) {
        throw new Error('O manifesto contém um recurso inválido.');
      }
      const response = await fetch(url, { cache: 'reload' });
      if (!response.ok || response.type !== 'basic') {
        throw new Error(`Não foi possível guardar o recurso offline: ${url}`);
      }
      const cacheControl = response.headers.get('Cache-Control') || '';
      if (/(?:^|,)\\s*(?:no-store|private)\\b/i.test(cacheControl)) {
        throw new Error(`O recurso não pode ser guardado offline: ${url}`);
      }
      await cache.put(url, response.clone());
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith('agrilink-shell-') && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Nunca armazenar respostas de autenticação, API, funções, storage ou realtime.
  // Esses dados exigem validação online e regras de autorização do servidor.
  if (PRIVATE_OR_API_PATH.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        await cacheIfSafe(cache, '/index.html', response);
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match('/index.html')) || (await cache.match('/')) ||
          new Response('AgriLink está offline. Abra novamente quando a aplicação tiver sido carregada pelo menos uma vez com internet.', {
            status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
      }
    })());
    return;
  }

  // O shell e os recursos compilados usam rede primeiro, cache como fallback.
  // Evita devolver HTML para um pedido de JavaScript ou CSS.
  if (['script', 'style', 'font', 'image', 'worker'].includes(request.destination) ||
      url.pathname === '/manifest.webmanifest' || url.pathname === '/precache-manifest.json') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        await cacheIfSafe(cache, request, response);
        return response;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw new Error('Recurso não disponível offline.');
      }
    })());
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'Notificação AgriLink',
    body: 'Você tem uma nova notificação',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'agrilink-notification',
    data: {},
    actions: [{ action: 'open', title: 'Abrir' }, { action: 'close', title: 'Fechar' }],
    requireInteraction: false,
    renotify: true,
    vibrate: [200, 100, 200],
  };
  if (event.data) {
    try { notificationData = { ...notificationData, ...event.data.json() }; }
    catch { notificationData.body = event.data.text(); }
  }
  const eventId = notificationData?.data?.notification_id || notificationData?.data?.id || crypto.randomUUID();
  notificationData.tag = 'agrilink-' + eventId;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const activeClients = clients.filter((client) => client.visibilityState === 'visible' && client.focused);
    if (activeClients.length) {
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
    return self.registration.showNotification(notificationData.title, notificationData);
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    const targetPath = event.notification?.data?.path;
    let targetUrl = self.location.origin + '/notificacoes';
    if (typeof targetPath === 'string' && targetPath.startsWith('/') &&
        !targetPath.startsWith('//') && !targetPath.includes('\\\\')) {
      try {
        const parsedTarget = new URL(targetPath, self.location.origin);
        if (parsedTarget.origin === self.location.origin) targetUrl = parsedTarget.toString();
      } catch { /* Mantém o destino interno padrão. */ }
    }
    for (const client of clientList) {
      if (client.url === targetUrl && 'focus' in client) return client.focus();
    }
    for (const client of clientList) {
      if ('focus' in client && client.url.startsWith(self.location.origin)) {
        if ('navigate' in client) return client.navigate(targetUrl).then(() => client.focus());
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
  }));
});
