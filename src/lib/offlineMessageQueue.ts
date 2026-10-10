const DB_NAME = "agrilink-offline-outbox";
const DB_VERSION = 1;
const MESSAGE_STORE = "messages";
const KEY_STORE = "keys";

export interface PendingMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: false;
  files: [];
}

interface StoredPendingMessage extends Omit<PendingMessage, "content" | "files"> {
  encrypted_content: string;
  iv: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Este navegador não permite guardar mensagens offline."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MESSAGE_STORE)) {
        db.createObjectStore(MESSAGE_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(KEY_STORE)) {
        db.createObjectStore(KEY_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir a caixa de saída offline."));
  });
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function getDeviceKey(db: IDBDatabase): Promise<CryptoKey> {
  const existing = await new Promise<CryptoKey | null>((resolve, reject) => {
    const request = db.transaction(KEY_STORE, "readonly").objectStore(KEY_STORE).get("device-key");
    request.onsuccess = () => resolve((request.result?.key as CryptoKey | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  if (existing) return existing;

  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, "readwrite");
    tx.objectStore(KEY_STORE).put({ id: "device-key", key });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Não foi possível proteger a caixa de saída."));
  });
  return key;
}

export async function savePendingMessage(message: PendingMessage): Promise<void> {
  const db = await openDatabase();
  try {
    const key = await getDeviceKey(db);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(message.content),
    );
    const record: StoredPendingMessage = {
      id: message.id,
      conversation_id: message.conversation_id,
      sender_id: message.sender_id,
      receiver_id: message.receiver_id,
      created_at: message.created_at,
      read: false,
      encrypted_content: toBase64(new Uint8Array(ciphertext)),
      iv: toBase64(iv),
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MESSAGE_STORE, "readwrite");
      tx.objectStore(MESSAGE_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("A mensagem não foi guardada na caixa de saída."));
    });
  } finally {
    db.close();
  }
}

export async function getPendingMessages(
  userId: string,
  conversationId?: string,
): Promise<PendingMessage[]> {
  const db = await openDatabase();
  try {
    const records = await new Promise<StoredPendingMessage[]>((resolve, reject) => {
      const request = db.transaction(MESSAGE_STORE, "readonly").objectStore(MESSAGE_STORE).getAll();
      request.onsuccess = () => resolve(request.result as StoredPendingMessage[]);
      request.onerror = () => reject(request.error);
    });
    const relevant = records.filter((item) =>
      item.sender_id === userId && (!conversationId || item.conversation_id === conversationId)
    );
    if (relevant.length === 0) return [];
    const key = await getDeviceKey(db);
    return await Promise.all(relevant.map(async (item) => {
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromBase64(item.iv) },
        key,
        fromBase64(item.encrypted_content),
      );
      return {
        id: item.id,
        conversation_id: item.conversation_id,
        sender_id: item.sender_id,
        receiver_id: item.receiver_id,
        content: new TextDecoder().decode(plaintext),
        created_at: item.created_at,
        read: false as const,
        files: [] as [],
      };
    }));
  } finally {
    db.close();
  }
}

export async function deletePendingMessage(id: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MESSAGE_STORE, "readwrite");
      tx.objectStore(MESSAGE_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Não foi possível remover a mensagem enviada da caixa de saída."));
    });
  } finally {
    db.close();
  }
}
