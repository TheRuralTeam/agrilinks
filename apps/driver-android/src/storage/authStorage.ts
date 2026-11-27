import { getTrackingDatabase, withDatabaseWrite } from "./trackingDatabase";

export const secureAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    const database = await getTrackingDatabase();
    const row = await database.getFirstAsync<{ value: string }>(
      "SELECT value FROM auth_storage WHERE key = ?",
      key,
    );
    return row?.value ?? null;
  },

  async setItem(key: string, value: string): Promise<void> {
    await withDatabaseWrite(async (database) => {
      await database.runAsync(
        "INSERT INTO auth_storage (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        key,
        value,
      );
    });
  },

  async removeItem(key: string): Promise<void> {
    await withDatabaseWrite(async (database) => {
      await database.runAsync("DELETE FROM auth_storage WHERE key = ?", key);
    });
  },
};
