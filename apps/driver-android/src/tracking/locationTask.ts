import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { flushLocationOutbox, persistLocationSamples } from "./outbox";

export const DRIVER_LOCATION_TASK = "AGRILINK_DRIVER_LOCATION_V1";

TaskManager.defineTask(DRIVER_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    // Do not invent or replay a location when the operating system reports a task error.
    return;
  }

  const locations =
    (data as { locations?: Location.LocationObject[] } | undefined)?.locations ?? [];

  if (locations.length === 0) return;

  try {
    await persistLocationSamples(locations);
    await flushLocationOutbox();
  } catch {
    // Persisted samples remain in the encrypted outbox for the next foreground/network retry.
  }
});
