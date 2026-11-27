import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import * as Network from "expo-network";
import {
  getOrCreateDeviceId,
  getTrackingDatabase,
  getActiveTrackingLoadIds,
  withDatabaseWrite,
} from "../storage/trackingDatabase";
import { supabase } from "../lib/supabase";

interface OutboxRow {
  id: string;
  client_event_id: string;
  device_sequence: number;
  captured_at: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  heading_deg: number | null;
}

function nullableInRange(value: number | null, maximum: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum
    ? value
    : null;
}

export async function persistLocationSamples(
  locations: Location.LocationObject[],
): Promise<number> {
  if (locations.length === 0) return 0;

  const loadIds = await getActiveTrackingLoadIds();
  if (loadIds.length === 0) return 0;

  return withDatabaseWrite(async (database) => {
    let inserted = 0;

    await database.withTransactionAsync(async () => {
      for (const location of locations) {
        const { latitude, longitude, accuracy, speed, heading } = location.coords;
        if (
          !Number.isFinite(location.timestamp) ||
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          continue;
        }

        const capturedAt = new Date(location.timestamp).toISOString();
        const eventId = Crypto.randomUUID();
        const sequenceRow = await database.getFirstAsync<{ value: string }>(
          "SELECT value FROM tracking_meta WHERE key = ?",
          "device_sequence",
        );
        const nextSequence = Number(sequenceRow?.value ?? 0) + 1;

        await database.runAsync(
          "INSERT INTO tracking_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
          "device_sequence",
          String(nextSequence),
        );

        for (const loadId of loadIds) {
          const result = await database.runAsync(
            "INSERT OR IGNORE INTO gps_outbox ("
              "id, freight_load_id, client_event_id, device_sequence, captured_at, " +
              "latitude, longitude, accuracy_m, speed_mps, heading_deg, created_at" +
              ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            Crypto.randomUUID(),
            loadId,
            eventId,
            nextSequence,
            capturedAt,
            latitude,
            longitude,
            nullableInRange(accuracy, 100_000),
            nullableInRange(speed, 100),
            typeof heading === "number" &&
              Number.isFinite(heading) &&
              heading >= 0 &&
              heading < 360
              ? heading
              : null,
            new Date().toISOString(),
          );
          inserted += result.changes;
        }
      }
    });

    return inserted;
  });
}

async function recordSyncFailure(
  rows: OutboxRow[],
  message: string,
): Promise<void> {
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return;

  await withDatabaseWrite(async (lockedDatabase) => {
    const placeholders = ids.map(() => "?").join(",");
    await lockedDatabase.runAsync(
      "UPDATE gps_outbox SET sync_attempts = sync_attempts + 1, last_error = ? " +
        "WHERE id IN (" +
        placeholders +
        ")",
      message.slice(0, 400),
      ...ids,
    );
  });
}

export async function flushLocationOutbox(): Promise<number> {
  const network = await Network.getNetworkStateAsync();
  if (network.isConnected === false || network.isInternetReachable === false) {
    return 0;
  }

  const database = await getTrackingDatabase();
  const deviceId = await getOrCreateDeviceId();
  const loadRows = await database.getAllAsync<{ freight_load_id: string }>(
    "SELECT DISTINCT freight_load_id FROM gps_outbox ORDER BY freight_load_id",
  );

  let synchronized = 0;

  for (const load of loadRows) {
    while (true) {
      const rows = await database.getAllAsync<OutboxRow>(
        "SELECT id, client_event_id, device_sequence, captured_at, latitude, longitude, " +
          "accuracy_m, speed_mps, heading_deg " +
          "FROM gps_outbox WHERE freight_load_id = ? " +
          "ORDER BY captured_at ASC, device_sequence ASC LIMIT 100",
        load.freight_load_id,
      );

      if (rows.length === 0) break;

      const { error } = await supabase.rpc("record_freight_load_location_batch", {
        p_freight_load_id: load.freight_load_id,
        p_device_id: deviceId,
        p_samples: rows.map((row) => ({
          client_event_id: row.client_event_id,
          device_sequence: row.device_sequence,
          captured_at: row.captured_at,
          latitude: row.latitude,
          longitude: row.longitude,
          accuracy_m: row.accuracy_m,
          speed_mps: row.speed_mps,
          heading_deg: row.heading_deg,
        })),
      });

      if (error) {
        await recordSyncFailure(rows, error.message || "Falha de sincronização");
        break;
      }

      const ids = rows.map((row) => row.id);
      await withDatabaseWrite(async (lockedDatabase) => {
        const placeholders = ids.map(() => "?").join(",");
        await lockedDatabase.runAsync(
          "DELETE FROM gps_outbox WHERE id IN (" + placeholders + ")",
          ...ids,
        );
      });

      synchronized += rows.length;
      if (rows.length < 100) break;
    }
  }

  return synchronized;
}
