import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";

const DATABASE_NAME = "agrilink-driver-secure.db";
const DATABASE_KEY_NAME = "agrilink.driver.database-key.v1";
const DEVICE_ID_NAME = "agrilink.driver.device-id.v1";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function randomHex(byteCount: number): string {
  return Array.from(Crypto.getRandomBytes(byteCount))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function withDatabaseWrite<T>(
  operation: (database: SQLite.SQLiteDatabase) => Promise<T>,
): Promise<T> {
  const result = writeQueue.then(async () => operation(await getTrackingDatabase()));
  writeQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function getTrackingDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      let databaseKey = await SecureStore.getItemAsync(DATABASE_KEY_NAME);
      if (!databaseKey) {
        databaseKey = randomHex(32);
        await SecureStore.setItemAsync(DATABASE_KEY_NAME, databaseKey);
      }

      const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
      const cipher = await database.getFirstAsync<{ cipher_version: string }>(
        "PRAGMA cipher_version",
      );

      if (!cipher?.cipher_version) {
        await database.closeAsync();
        throw new Error(
          "Este APK não tem SQLCipher activo. Gere novamente o build nativo com useSQLCipher=true.",
        );
      }

      // The key is generated locally and contains hexadecimal characters only.
      await database.execAsync("PRAGMA key = \"x'" + databaseKey + "'\";");

      try {
        // Forces SQLCipher to authenticate/decrypt the database before use.
        await database.getFirstAsync<{ count: number }>(
          "SELECT count(*) AS count FROM sqlite_master",
        );
      } catch {
        await database.closeAsync();
        throw new Error(
          "Não foi possível abrir a fila cifrada. A chave segura do dispositivo pode estar indisponível.",
        );
      }

      await database.execAsync(
        "PRAGMA cipher_memory_security = ON; " +
          "PRAGMA journal_mode = WAL; " +
          "PRAGMA foreign_keys = ON; " +
          "CREATE TABLE IF NOT EXISTS auth_storage (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL); " +
          "CREATE TABLE IF NOT EXISTS tracking_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL); " +
          "CREATE TABLE IF NOT EXISTS active_tracking_loads (load_id TEXT PRIMARY KEY NOT NULL, updated_at TEXT NOT NULL); " +
          "CREATE TABLE IF NOT EXISTS gps_outbox (" +
          "id TEXT PRIMARY KEY NOT NULL, freight_load_id TEXT NOT NULL, client_event_id TEXT NOT NULL, " +
          "device_sequence INTEGER NOT NULL, captured_at TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, " +
          "accuracy_m REAL, speed_mps REAL, heading_deg REAL, sync_attempts INTEGER NOT NULL DEFAULT 0, " +
          "last_error TEXT, created_at TEXT NOT NULL, UNIQUE (freight_load_id, client_event_id)); " +
          "CREATE INDEX IF NOT EXISTS gps_outbox_load_capture_idx ON gps_outbox (freight_load_id, captured_at, device_sequence);",
      );

      return database;
    })().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_NAME);
  if (existing) return existing;

  const created = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_NAME, created);
  return created;
}

export interface OutboxStats {
  pending: number;
  oldestCapturedAt: string | null;
  failedAttempts: number;
}

export async function getOutboxStats(): Promise<OutboxStats> {
  const database = await getTrackingDatabase();
  const result = await database.getFirstAsync<{
    pending: number;
    oldest_captured_at: string | null;
    failed_attempts: number;
  }>(
    "SELECT count(*) AS pending, min(captured_at) AS oldest_captured_at, " +
      "coalesce(sum(CASE WHEN sync_attempts > 0 THEN 1 ELSE 0 END), 0) AS failed_attempts " +
      "FROM gps_outbox",
  );

  return {
    pending: Number(result?.pending ?? 0),
    oldestCapturedAt: result?.oldest_captured_at ?? null,
    failedAttempts: Number(result?.failed_attempts ?? 0),
  };
}

export async function getActiveTrackingLoadIds(): Promise<string[]> {
  const database = await getTrackingDatabase();
  const rows = await database.getAllAsync<{ load_id: string }>(
    "SELECT load_id FROM active_tracking_loads ORDER BY updated_at ASC",
  );
  return rows.map((row) => row.load_id);
}

export async function replaceActiveTrackingLoadIds(loadIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(loadIds.filter(Boolean))];
  await withDatabaseWrite(async (database) => {
    await database.withTransactionAsync(async () => {
      await database.runAsync("DELETE FROM active_tracking_loads");
      const updatedAt = new Date().toISOString();
      for (const loadId of uniqueIds) {
        await database.runAsync(
          "INSERT INTO active_tracking_loads (load_id, updated_at) VALUES (?, ?)",
          loadId,
          updatedAt,
        );
      }
    });
  });
}

export async function getTrackingConsent(): Promise<boolean> {
  const database = await getTrackingDatabase();
  const row = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM tracking_meta WHERE key = ?",
    "background_tracking_consent",
  );
  return row?.value === "granted";
}

export async function setTrackingConsent(granted: boolean): Promise<void> {
  await withDatabaseWrite(async (database) => {
    await database.runAsync(
      "INSERT INTO tracking_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      "background_tracking_consent",
      granted ? "granted" : "revoked",
    );
  });
}
