import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "agrilink-chat-keys";
const STORE_NAME = "keys";
const KEY_VERSION = 1;
const ENVELOPE_PREFIX = "agrilink-e2ee:";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const keyInitialization = new Map<string, Promise<JsonWebKey>>();

type StoredKeyPair = { userId: string; privateKey: CryptoKey; publicKey: JsonWebKey };
type MessageEnvelope = {
  v: 1;
  alg: "ECDH-P256+HKDF-SHA256+AES-256-GCM";
  senderId: string;
  recipientId: string;
  senderPublicKey: JsonWebKey;
  recipientPublicKey: JsonWebKey;
  iv: string;
  ciphertext: string;
};

function openKeyDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Este navegador não disponibiliza armazenamento seguro de chaves."));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "userId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir o cofre local de chaves."));
  });
}

async function readStoredKeyPair(userId: string): Promise<StoredKeyPair | null> {
  const db = await openKeyDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(userId);
    request.onsuccess = () => {
      db.close();
      resolve((request.result as StoredKeyPair | undefined) ?? null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error ?? new Error("Não foi possível ler a chave local."));
    };
  });
}

async function storeKeyPair(pair: StoredKeyPair): Promise<void> {
  const db = await openKeyDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(pair);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error("Não foi possível guardar a chave local.")); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error("A gravação da chave local foi cancelada.")); };
  });
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function deriveAesKey(privateKey: CryptoKey, peerPublicJwk: JsonWebKey, conversationId: string): Promise<CryptoKey> {
  const peerPublicKey = await crypto.subtle.importKey(
    "jwk",
    peerPublicJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: peerPublicKey },
    privateKey,
    256,
  );
  const hkdfKey = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode(conversationId),
      info: encoder.encode("AgriLink chat E2EE v1"),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function initializeChatEncryptionKey(userId: string): Promise<JsonWebKey> {
  const existing = await readStoredKeyPair(userId);
  if (existing) {
    await publishPublicKey(userId, existing.publicKey);
    return existing.publicKey;
  }

  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  ) as CryptoKeyPair;
  const publicKey = await crypto.subtle.exportKey("jwk", pair.publicKey);
  await storeKeyPair({ userId, privateKey: pair.privateKey, publicKey });
  await publishPublicKey(userId, publicKey);
  return publicKey;
}

export async function ensureChatEncryptionKey(userId: string): Promise<JsonWebKey> {
  const existingInitialization = keyInitialization.get(userId);
  if (existingInitialization) return existingInitialization;

  const initialization = initializeChatEncryptionKey(userId);
  keyInitialization.set(userId, initialization);
  try {
    return await initialization;
  } finally {
    if (keyInitialization.get(userId) === initialization) keyInitialization.delete(userId);
  }
}

async function publishPublicKey(userId: string, publicKey: JsonWebKey): Promise<void> {
  const { error } = await supabase.from("chat_encryption_keys").upsert({
    user_id: userId,
    public_key: JSON.parse(JSON.stringify(publicKey)),
    key_version: KEY_VERSION,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw new Error("Não foi possível registar a chave pública de segurança do chat.");
}

async function getPublicKey(userId: string): Promise<JsonWebKey> {
  const { data, error } = await supabase
    .from("chat_encryption_keys")
    .select("public_key")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível consultar a chave pública do destinatário.");
  if (!data?.public_key) {
    throw new Error("O destinatário ainda não activou o chat seguro. Peça-lhe para abrir a conversa novamente.");
  }
  return data.public_key as JsonWebKey;
}

export async function encryptChatMessage(
  content: string,
  conversationId: string,
  senderId: string,
  recipientId: string,
): Promise<string> {
  if (!content) return content;
  const senderPublicKey = await ensureChatEncryptionKey(senderId);
  const recipientPublicKey = await getPublicKey(recipientId);
  const stored = await readStoredKeyPair(senderId);
  if (!stored) throw new Error("A chave privada local não está disponível.");

  const key = await deriveAesKey(stored.privateKey, recipientPublicKey, conversationId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(content),
  );
  const envelope: MessageEnvelope = {
    v: 1,
    alg: "ECDH-P256+HKDF-SHA256+AES-256-GCM",
    senderId,
    recipientId,
    senderPublicKey,
    recipientPublicKey,
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
  return ENVELOPE_PREFIX + toBase64(encoder.encode(JSON.stringify(envelope)));
}

export async function decryptChatMessage(
  storedContent: string,
  conversationId: string,
  currentUserId: string,
): Promise<string> {
  if (!storedContent?.startsWith(ENVELOPE_PREFIX)) {
    return storedContent ? `[Mensagem antiga — não cifrada] ${storedContent}` : "";
  }

  try {
    const envelopeBytes = fromBase64(storedContent.slice(ENVELOPE_PREFIX.length));
    const envelope = JSON.parse(decoder.decode(envelopeBytes)) as MessageEnvelope;
    if (
      envelope.v !== 1 ||
      envelope.alg !== "ECDH-P256+HKDF-SHA256+AES-256-GCM" ||
      (envelope.senderId !== currentUserId && envelope.recipientId !== currentUserId)
    ) {
      throw new Error("Envelope de mensagem inválido.");
    }

    const localPair = await readStoredKeyPair(currentUserId);
    if (!localPair) throw new Error("A chave privada deste dispositivo não está disponível.");
    const peerPublicKey = envelope.senderId === currentUserId
      ? envelope.recipientPublicKey
      : envelope.senderPublicKey;
    const key = await deriveAesKey(localPair.privateKey, peerPublicKey, conversationId);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(envelope.iv) },
      key,
      fromBase64(envelope.ciphertext),
    );
    return decoder.decode(plaintext);
  } catch {
    return "[Não foi possível decifrar esta mensagem neste dispositivo]";
  }
}

export function isEncryptedChatMessage(content: string): boolean {
  return Boolean(content?.startsWith(ENVELOPE_PREFIX));
}
