type CachedApiResponse = {
  id: string;
  userId: string;
  url: string;
  body: string;
  status: number;
  statusText: string;
  headers: [string, string][];
  cachedAt: number;
};

const DB_NAME = 'agrilink-offline-data';
const STORE_NAME = 'read-responses';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Armazenamento offline indisponível.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir a cache offline.'));
  });
}

function getUserIdFromAuthorization(value: string | null): string | null {
  if (!value?.startsWith('Bearer ')) return null;
  const token = value.slice(7);
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
    const claims = JSON.parse(decoded) as { sub?: unknown; role?: unknown };
    return typeof claims.sub === 'string' && claims.role !== 'anon' ? claims.sub : null;
  } catch {
    return null;
  }
}

async function saveResponse(record: CachedApiResponse): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Não foi possível guardar dados para uso offline.'));
    tx.onabort = () => reject(tx.error ?? new Error('A gravação da cache offline foi cancelada.'));
  }).finally(() => db.close());
}

async function readResponse(id: string): Promise<CachedApiResponse | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as CachedApiResponse | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('Não foi possível ler os dados offline.'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Não foi possível ler os dados offline.'));
    };
  });
}

/**
 * Cache local apenas para leituras REST autenticadas e separadas por utilizador.
 * Não guarda autenticação, funções, storage, realtime ou operações de escrita.
 */
export async function offlineAwareFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : null;
  const url = new URL(request?.url ?? String(input), window.location.origin);
  const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
  const headers = new Headers(init?.headers ?? request?.headers);
  const userId = getUserIdFromAuthorization(headers.get('Authorization'));
  const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const isSupabaseOrigin = (configuredSupabaseUrl && url.origin === new URL(configuredSupabaseUrl).origin) ||
    url.hostname.endsWith('.supabase.co');
  const canCache = method === 'GET' &&
    isSupabaseOrigin &&
    url.pathname.startsWith('/rest/v1/') &&
    !url.pathname.includes('/rpc/') &&
    !headers.has('Range') &&
    !!userId;
  const representationKey = [
    headers.get('Accept') || '',
    headers.get('Accept-Profile') || '',
    headers.get('Content-Profile') || '',
    headers.get('Prefer') || '',
  ].join('|');
  const cacheId = canCache ? `${userId}:${url.toString()}:representation=${representationKey}` : '';

  try {
    const response = await fetch(input, init);
    if (canCache && response.ok && /application\/(?:json|[^;]+\+json)/i.test(response.headers.get('Content-Type') || '')) {
      const cacheControl = response.headers.get('Cache-Control') || '';
      if (!/(?:^|,)\s*no-store\b/i.test(cacheControl)) {
        try {
          await saveResponse({
            id: cacheId,
            userId: userId!,
            url: url.toString(),
            body: await response.clone().text(),
            status: response.status,
            statusText: response.statusText,
            headers: Array.from(response.headers.entries()),
            cachedAt: Date.now(),
          });
        } catch (cacheError) {
          console.warn('[AgriLink] Não foi possível persistir a leitura para uso offline.', cacheError);
        }
      }
    }
    return response;
  } catch (networkError) {
    if (!canCache) throw networkError;
    try {
      const cached = await readResponse(cacheId);
      if (cached) {
        const responseHeaders = new Headers(cached.headers);
        responseHeaders.delete('content-length');
        responseHeaders.delete('content-encoding');
        responseHeaders.delete('transfer-encoding');
        responseHeaders.delete('connection');
        responseHeaders.set('X-AgriLink-Offline-Cache', 'true');
        return new Response(cached.body, {
          status: cached.status,
          statusText: cached.statusText,
          headers: responseHeaders,
        });
      }
    } catch (cacheError) {
      console.warn('[AgriLink] Não foi possível ler a cache offline.', cacheError);
    }
    throw networkError;
  }
}

/** Remove dados REST locais ao terminar a sessão, para não os expor ao próximo utilizador do dispositivo. */
export async function clearOfflineReadCache(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Não foi possível limpar a cache offline.'));
    tx.onabort = () => reject(tx.error ?? new Error('A limpeza da cache offline foi cancelada.'));
  }).finally(() => db.close());
}
