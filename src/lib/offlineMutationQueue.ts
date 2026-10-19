import { supabase } from '../integrations/supabase/client';
import { ensureChatEncryptionKey } from './chatEncryption';

type OfflineFile = { name: string; type: string; blob: Blob };
type PendingInsert = {
  id: string;
  userId: string;
  table: 'products' | 'sourcing_requests' | 'messages' | 'users' | 'pre_order_intent';
  operation?: 'insert' | 'update' | 'preorder';
  targetId?: string;
  baseUpdatedAt?: string | null;
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
    id, userId: input.userId, table: input.table, operation: 'insert', row,
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

export async function enqueueOfflinePreOrder(input: {
  userId: string;
  productId: string;
  quantity: number;
  location: string;
  deliveryLat?: number;
  deliveryLng?: number;
  idempotencyKey?: string;
}): Promise<string> {
  if (!input.userId || !input.productId) throw new Error('É necessário iniciar sessão e seleccionar um produto.');
  const idempotencyKey = input.idempotencyKey || crypto.randomUUID();
  const id = `preorder:${input.userId}:${idempotencyKey}`;
  const record: PendingInsert = {
    id,
    userId: input.userId,
    table: 'pre_order_intent',
    operation: 'preorder',
    targetId: input.productId,
    row: {
      product_id: input.productId,
      quantity: input.quantity,
      location: input.location,
      delivery_lat: input.deliveryLat ?? null,
      delivery_lng: input.deliveryLng ?? null,
      idempotency_key: idempotencyKey,
    },
    files: [],
    createdAt: Date.now(),
    attempts: 0,
  };
  await transaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Não foi possível guardar a pré-compra offline.'));
  });
  window.dispatchEvent(new CustomEvent('agrilink:offline-queue-changed'));
  return id;
}

export async function enqueueOfflineUpdate(input: {
  userId: string;
  table: 'users' | 'products';
  targetId: string;
  values: Record<string, unknown>;
  baseUpdatedAt?: string | null;
}): Promise<string> {
  if (!input.userId || !input.targetId) throw new Error('Utilizador e registo são obrigatórios para guardar a alteração.');
  const id = `update:${input.table}:${input.userId}:${input.targetId}`;
  const record: PendingInsert = {
    id,
    userId: input.userId,
    table: input.table,
    operation: 'update',
    targetId: input.targetId,
    baseUpdatedAt: input.baseUpdatedAt ?? null,
    row: input.values,
    files: [],
    createdAt: Date.now(),
    attempts: 0,
  };
  await transaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Não foi possível guardar a edição offline.'));
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

export async function getOfflineQueueError(userId: string): Promise<string | null> {
  const pending = await listPending(userId);
  const failed = pending.find((record) => Boolean(record.lastError));
  return failed?.lastError ?? null;
}

export async function getPendingOfflineMessages(userId: string, conversationId: string): Promise<Record<string, unknown>[]> {
  const pending = await listPending(userId);
  return pending
    .filter((record) => record.table === 'messages' && record.row.conversation_id === conversationId)
    .map((record) => record.row);
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
  if (record.operation === 'preorder') {
    const { data, error } = await supabase.rpc('create_marketplace_pre_order', {
      p_product_id: String(record.row.product_id),
      p_quantity: Number(record.row.quantity),
      p_location: String(record.row.location ?? ''),
      p_delivery_lat: typeof record.row.delivery_lat === 'number' ? record.row.delivery_lat : undefined,
      p_delivery_lng: typeof record.row.delivery_lng === 'number' ? record.row.delivery_lng : undefined,
      p_idempotency_key: String(record.row.idempotency_key),
    });
    if (error) throw new Error(`Pré-compra offline ainda não confirmada pelo servidor: ${error.message}`);
    if (!data || (Array.isArray(data) && data.length === 0)) {
      throw new Error('O servidor não devolveu confirmação da pré-compra offline.');
    }
    window.dispatchEvent(new CustomEvent('agrilink:offline-preorder-synced', { detail: { id: record.id } }));
    return;
  }
  if (record.operation === 'update') {
    if (!record.targetId || !['users', 'products'].includes(record.table)) {
      throw new Error('A edição offline não tem um destino válido.');
    }
    let currentQuery = client.from(record.table).select('id,updated_at').eq('id', record.targetId);
    if (record.table === 'products') currentQuery = currentQuery.eq('user_id', record.userId);
    const { data: current, error: currentError } = await currentQuery.maybeSingle();
    if (currentError) throw currentError;
    if (!current?.id) throw new Error('A edição não foi aplicada: o registo pode ter sido removido ou já não estar acessível.');
    if (record.baseUpdatedAt && current.updated_at && current.updated_at !== record.baseUpdatedAt) {
      throw new Error('Conflito de sincronização: este registo foi alterado no servidor enquanto o dispositivo estava offline. A alteração local foi preservada e precisa de ser revista antes de substituir a versão online.');
    }
    let query = client.from(record.table).update(record.row).eq('id', record.targetId);
    if (record.table === 'products') query = query.eq('user_id', record.userId);
    const { data, error } = await query.select('id').maybeSingle();
    if (error) throw error;
    if (!data?.id) throw new Error('A edição não foi aplicada: o registo pode ter sido removido ou já não estar acessível.');
    return;
  }
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
        if (record.table === 'messages') {
          window.dispatchEvent(new CustomEvent('agrilink:offline-message-synced', { detail: { id: record.id } }));
        }
        window.dispatchEvent(new CustomEvent('agrilink:offline-queue-changed'));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha de sincronização';
        await markFailed(record, message);
        // A version conflict is isolated to this record; independent operations can still sync.
        if (record.operation === 'preorder' || message.startsWith('Conflito de sincronização:') || message.startsWith('A edição não foi aplicada:')) continue;
        // Network/authentication errors stop the queue to preserve ordering.
        break;
      }
    }
  } finally {
    flushing = false;
  }
  return { synced, remaining: await countPendingOfflineInserts(userId) };
}
