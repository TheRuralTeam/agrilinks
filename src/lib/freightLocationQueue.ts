export interface QueuedFreightLocation {
  id: string;
  freight_load_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
  recorded_at: string;
}

const DB_NAME = 'agrilink-offline-location';
const STORE_NAME = 'pending-locations';
const DB_VERSION = 1;

const openQueueDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('O armazenamento offline não está disponível neste dispositivo.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('freight_load_id', 'freight_load_id', { unique: false });
        store.createIndex('recorded_at', 'recorded_at', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir a fila GPS offline.'));
    request.onblocked = () => reject(new Error('A fila GPS offline está bloqueada por outra janela.'));
  });

export async function enqueueFreightLocation(
  location: Omit<QueuedFreightLocation, 'id'>
): Promise<void> {
  const db = await openQueueDb();
  const record: QueuedFreightLocation = {
    ...location,
    id: `${location.freight_load_id}:${location.recorded_at}`,
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Não foi possível guardar a posição GPS.'));
    tx.onabort = () => reject(tx.error ?? new Error('A gravação da posição GPS foi cancelada.'));
  }).finally(() => db.close());
}

export async function getQueuedFreightLocations(
  freightLoadId: string
): Promise<QueuedFreightLocation[]> {
  const db = await openQueueDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).index('freight_load_id').getAll(freightLoadId);
    request.onsuccess = () => {
      const records = request.result as QueuedFreightLocation[];
      resolve(records.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)));
    };
    request.onerror = () => reject(request.error ?? new Error('Não foi possível ler a fila GPS offline.'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Não foi possível ler a fila GPS offline.'));
    };
  });
}

export async function removeQueuedFreightLocation(id: string): Promise<void> {
  const db = await openQueueDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Não foi possível confirmar a sincronização GPS.'));
    tx.onabort = () => reject(tx.error ?? new Error('A remoção da posição sincronizada foi cancelada.'));
  }).finally(() => db.close());
}
