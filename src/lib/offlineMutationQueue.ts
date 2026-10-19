import { supabase } from '../integrations/supabase/client';
import { ensureChatEncryptionKey } from './chatEncryption';

type OfflineFile = { name: string; type: string; blob: Blob };
type PendingInsert = {
  id: string;
  userId: string;
  table: 'products' | 'sourcing_requests' | 'messages';
  row: Record<string, unknown>;
  files: OfflineFile[];
  createdAt: number;
  attempts: number;
  lastError?: string;
};
const DB_NAME = 'agrilink-offline-mutations';
const STORE = 'pending-inserts';
const DB_VERSION = 2;
let flushing = false;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const writes = db.createObjectStore(STORE, { keyPath: 'id' });
        writes.createIndex('userId', 'userId', { unique: false });
        writes.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o armazenamento offline.'));
  });
}

async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason: Error) => void) => void): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    let result: T | undefined;
    let settled = false;
    action(tx.objectStore(STORE), (value) => { result = value; }, (reason) => {
      if (settled) return;
      settled = true;
      reject(reason);
    });
    tx.oncomplete = () => {
      db.close();
      if (!settled) {
        settled = true;
        resolve(result as T);
      }
    };
    tx.onerror = () => {
      db.close();
      if (!settled) {
        settled = true;
        reject(tx.error ?? new Error('Falha no armazenamento offline.'));
      }
    };
    tx.onabort = () => {
      db.close();
      if (!settled) {
        settled = true;
        reject(tx.error ?? new Error('Operação offline cancelada.'));
      }
    };
  });
}

export async function enqueueOfflineInsert(input: {
  userId: string;
  table: PendingInsert['table'];
  row: Record<string, unknown>;
  files?: File[];
}): Promise<string> {
  if (!input.userId) throw new Error('É necessário iniciar sessão antes de guardar a operação.');
  if (!['products', 'sourcing_requests', 'messages'].includes(input.table)) {
    throw new Error('Esta operação ainda não suporta gravação offline.');
  }
  const id = typeof input.row.id === 'string' ? input.row.id : crypto.randomUUID();
  const row = { ...input.row, id };
  const record: PendingInsert = {
    id, userId: input.userId, table: input.table, row,
    files: (input.files ?? []).map((file) => ({ name: file.name, type: file.type, blob: file })),
    createdAt: Date.now(), attempts: 0,
  };
  await transaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Não foi possível guardar a alteração offline.'));
  });
  window.dispatchEvent(new CustomEvent('agrilink:offline-queue-changed'));
  return id;
}

export async function countPendingOfflineInserts(userId?: string): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = userId
      ? tx.objectStore(STORE).index('userId').count(IDBKeyRange.only(userId))
      : tx.objectStore(STORE).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Não foi possível consultar a fila offline.'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Falha ao consultar a fila offline.')); };
  });
}

async function listPending(userId: string): Promise<PendingInsert[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).index('userId').getAll(IDBKeyRange.only(userId));
    request.onsuccess = () => resolve((request.result as PendingInsert[]).sort((a, b) => a.createdAt - b.createdAt));
    request.onerror = () => reject(request.error ?? new Error('Não foi possível ler a fila offline.'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Falha ao ler a fila offline.')); };
  });
}

async function deletePending(id: string): Promise<void> {
  await transaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Não foi possível remover a operação sincronizada.'));
  });
}

async function markFailed(record: PendingInsert, message: string): Promise<void> {
  await transaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.put({ ...record, attempts: record.attempts + 1, lastError: message });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Não foi possível guardar o estado da sincronização.'));
  });
}

async function uploadProductPhotos(record: PendingInsert): Promise<string[]> {
  const urls: string[] = [];
  for (let index = 0; index < record.files.length; index += 1) {
    const file = record.files[index];
    const extension = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
    const path = `${record.userId}/offline/${record.id}-${index}.${extension}`;
    const { error } = await supabase.storage.from('product-photos').upload(path, file.blob, {
      upsert: true, contentType: file.type || 'application/octet-stream',
    });
    if (error) throw error;
    urls.push(supabase.storage.from('product-photos').getPublicUrl(path).data.publicUrl);
  }
  return urls;
}

async function updateConversationSummary(record: PendingInsert): Promise<void> {
  if (record.table !== 'messages' || typeof record.row.conversation_id !== 'string') return;
  const { error } = await (supabase as any).from('conversations').update({
    last_message: '🔒 Mensagem encriptada',
    last_timestamp: typeof record.row.created_at === 'string' ? record.row.created_at : new Date().toISOString(),
  }).eq('id', record.row.conversation_id);
  if (error) console.warn('[AgriLink] A mensagem foi sincronizada, mas o resumo da conversa não foi actualizado.', error);
}

async function triggerPostInsertAutomation(record: PendingInsert): Promise<void> {
  if (record.table === 'products') {
    const { error } = await supabase.functions.invoke('verify-product-ficha', {
      body: { product_id: record.id },
    });
    if (error) console.warn('[AgriLink] Produto sincronizado; a verificação técnica automática não foi confirmada.', error);
  }
  if (record.table === 'sourcing_requests') {
    const { error } = await supabase.functions.invoke('agent-task-submit', {
      body: {
        task_type: 'sourcing_intake',
        autonomy_mode: 'suggest',
        idempotency_key: `sourcing-${record.id}`,
        input_payload: {
          sourcing_request_id: record.id,
          product_name: record.row.product_name,
          quantity: record.row.quantity,
          unit: record.row.unit,
          delivery_location: record.row.delivery_location,
          delivery_date: record.row.delivery_date,
          quality_specification: record.row.quality_specification,
        },
      },
    });
    if (error) console.warn('[AgriLink] Pedido sincronizado; a tarefa automática não foi confirmada.', error);
  }
}

async function insertIdempotently(record: PendingInsert): Promise<void> {
  const client = supabase as any;
  const ownerField = record.table === 'messages' ? 'sender_id' : 'user_id';
  const { data: existing, error: lookupError } = await client.from(record.table).select(`id,${ownerField}`).eq('id', record.id).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing?.id) {
    const owner = existing[ownerField];
    if (owner === record.userId) {
      await updateConversationSummary(record);
      if (record.table === 'sourcing_requests') await triggerPostInsertAutomation(record);
      return;
    }
    throw new Error('Conflito de identificador: a operação offline não foi sincronizada para proteger os dados existentes.');
  }

  if (record.table === 'messages') await ensureChatEncryptionKey(record.userId);
  const row = { ...record.row };
  if (record.table === 'products' && record.files.length) {
    row.photos = await uploadProductPhotos(record);
  }
  const { error } = await client.from(record.table).insert(row);
  if (!error) {
    await updateConversationSummary(record);
    await triggerPostInsertAutomation(record);
    return;
  }

  // A resposta pode ter-se perdido depois de o servidor confirmar o INSERT.
  // Só consideramos concluído se o mesmo ID já existir e pertencer ao utilizador.
  const { data: afterError } = await client.from(record.table).select(`id,${ownerField}`).eq('id', record.id).maybeSingle();
  const owner = afterError?.[ownerField];
  if (afterError?.id === record.id && owner === record.userId) {
    await updateConversationSummary(record);
    if (record.table === 'sourcing_requests') await triggerPostInsertAutomation(record);
    return;
  }
  throw error;
}

export async function flushOfflineInserts(userId: string): Promise<{ synced: number; remaining: number }> {
  if (!userId || !navigator.onLine || flushing) {
    return { synced: 0, remaining: await countPendingOfflineInserts(userId).catch(() => 0) };
  }
  flushing = true;
  let synced = 0;
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user?.id !== userId) {
      return { synced, remaining: await countPendingOfflineInserts(userId) };
    }
    for (const record of await listPending(userId)) {
      if (!navigator.onLine) break;
      try {
        await insertIdempotently(record);
        await deletePending(record.id);
        synced += 1;
        window.dispatchEvent(new CustomEvent('agrilink:offline-queue-changed'));
      } catch (error) {
        await markFailed(record, error instanceof Error ? error.message : 'Falha de sincronização');
        // Preserve order: a failed item must not be skipped by dependent operations.
        break;
      }
    }
  } finally {
    flushing = false;
  }
  return { synced, remaining: await countPendingOfflineInserts(userId) };
}
