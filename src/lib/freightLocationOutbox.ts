import { supabase } from '../integrations/supabase/client';

type LocationPayload = {
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  recorded_at: string;
};

type StoredSample = {
  id: string;
  freightLoadId: string;
  deviceId: string;
  sequence: number;
  capturedAt: string;
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
};

type MetaRecord = { key: string; value: string | number | CryptoKey };

const DB_NAME = 'agrilink-freight-location-outbox';
const DB_VERSION = 1;
const SAMPLE_STORE = 'samples';
const META_STORE = 'meta';
const BATCH_SIZE = 50;
let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined' || !globalThis.crypto?.subtle) {
    return Promise.reject(new Error('Este navegador não suporta armazenamento GPS local protegido.'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SAMPLE_STORE)) {
          const store = db.createObjectStore(SAMPLE_STORE, { keyPath: 'id' });
          store.createIndex('by_load_sequence', ['freightLoadId', 'sequence'], { unique: true });
        }
        if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Não foi possível abrir a fila GPS local.'));
      request.onblocked = () => reject(new Error('A fila GPS está bloqueada por outra janela da aplicação.'));
    });
  }
  return dbPromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Operação de armazenamento local falhou.'));
  });
}

async function getOrCreateMeta<T extends string | number | CryptoKey>(key: string, create: () => Promise<T> | T): Promise<T> {
  const db = await openDatabase();
  const readTx = db.transaction(META_STORE, 'readonly');
  const existing = await requestResult(readTx.objectStore(META_STORE).get(key)) as MetaRecord | undefined;
  if (existing) return existing.value as T;
  const value = await create();
  const writeTx = db.transaction(META_STORE, 'readwrite');
  writeTx.objectStore(META_STORE).put({ key, value } satisfies MetaRecord);
  await new Promise<void>((resolve, reject) => {
    writeTx.oncomplete = () => resolve();
    writeTx.onerror = () => reject(writeTx.error || new Error('Não foi possível guardar metadados GPS.'));
    writeTx.onabort = () => reject(writeTx.error || new Error('Gravação de metadados GPS cancelada.'));
  });
  return value;
}

async function getDeviceId(): Promise<string> {
  return getOrCreateMeta('device_id', () => crypto.randomUUID());
}

async function getEncryptionKey(): Promise<CryptoKey> {
  return getOrCreateMeta('encryption_key', () =>
    crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  );
}

async function nextSequence(): Promise<number> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    const store = tx.objectStore(META_STORE);
    const get = store.get('sequence');
    let next = 1;
    get.onsuccess = () => {
      next = Number((get.result as MetaRecord | undefined)?.value || 0) + 1;
      store.put({ key: 'sequence', value: next } satisfies MetaRecord);
    };
    tx.oncomplete = () => resolve(next);
    tx.onerror = () => reject(tx.error || new Error('Não foi possível reservar sequência GPS.'));
    tx.onabort = () => reject(tx.error || new Error('Reserva de sequência GPS cancelada.'));
  });
}

export async function enqueueFreightLocationSample(freightLoadId: string, location: LocationPayload): Promise<void> {
  if (!freightLoadId) throw new Error('Carga GPS não identificada.');
  const deviceId = await getDeviceId();
  const key = await getEncryptionKey();
  const sequence = await nextSequence();
  const sampleId = crypto.randomUUID();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = new TextEncoder().encode(JSON.stringify({
    client_event_id: sampleId,
    device_sequence: sequence,
    captured_at: location.recorded_at,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy_m: location.accuracy_m,
    speed_mps: location.speed_mps,
    heading_deg: location.heading_deg,
  }));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload);
  const db = await openDatabase();
  const tx = db.transaction(SAMPLE_STORE, 'readwrite');
  tx.objectStore(SAMPLE_STORE).put({
    id: sampleId, freightLoadId, deviceId, sequence, capturedAt: location.recorded_at,
    iv: iv.slice().buffer as ArrayBuffer, ciphertext,
  } satisfies StoredSample);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Não foi possível persistir a posição GPS.'));
    tx.onabort = () => reject(tx.error || new Error('Persistência GPS cancelada.'));
  });
}

async function getPendingSamples(freightLoadId: string): Promise<StoredSample[]> {
  const db = await openDatabase();
  const tx = db.transaction(SAMPLE_STORE, 'readonly');
  const index = tx.objectStore(SAMPLE_STORE).index('by_load_sequence');
  const range = IDBKeyRange.bound([freightLoadId, 0], [freightLoadId, Number.MAX_SAFE_INTEGER]);
  const rows = await requestResult(index.getAll(range)) as StoredSample[];
  return rows.sort((a, b) => a.sequence - b.sequence).slice(0, BATCH_SIZE);
}

async function removeAcknowledged(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await openDatabase();
  const tx = db.transaction(SAMPLE_STORE, 'readwrite');
  const store = tx.objectStore(SAMPLE_STORE);
  ids.forEach((id) => store.delete(id));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Não foi possível confirmar sincronização GPS.'));
    tx.onabort = () => reject(tx.error || new Error('Confirmação da fila GPS cancelada.'));
  });
}

export async function flushFreightLocationQueue(freightLoadId: string, client: SupabaseClient): Promise<{ synced: number; error: Error | null }> {
  let synced = 0;
  try {
    if (!navigator.onLine) return { synced, error: null };
    const batch = await getPendingSamples(freightLoadId);
    if (!batch.length) return { synced, error: null };
    const key = await getEncryptionKey();
    const deviceId = batch[0].deviceId;
    const samples = await Promise.all(batch.map(async (item) => {
      const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(item.iv) }, key, item.ciphertext);
      return JSON.parse(new TextDecoder().decode(plaintext)) as Record<string, unknown>;
    }));
    const { data, error } = await supabase.rpc('record_freight_load_location_batch', {
      p_freight_load_id: freightLoadId,
      p_device_id: deviceId,
      p_samples: samples,
    });
    if (error) throw error;
    if (typeof data !== 'number' || data < 0) throw new Error('Resposta inválida ao sincronizar posições GPS.');
    await removeAcknowledged(batch.map((item) => item.id));
    synced = batch.length;
    if (batch.length === BATCH_SIZE) {
      const next = await flushFreightLocationQueue(freightLoadId);
      return { synced: synced + next.synced, error: next.error };
    }
    return { synced, error: null };
  } catch (cause) {
    return { synced, error: cause instanceof Error ? cause : new Error('Falha ao sincronizar posições GPS.') };
  }
}
