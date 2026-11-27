import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { flushLocationOutbox } from "./outbox";
import { DRIVER_LOCATION_TASK } from "./locationTask";
import {
  getTrackingConsent,
  replaceActiveTrackingLoadIds,
  setTrackingConsent,
} from "../storage/trackingDatabase";

export async function isDriverLocationServiceRunning(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
}

async function startForegroundLocationService(): Promise<void> {
  const alreadyRunning = await isDriverLocationServiceRunning();
  if (alreadyRunning) return;

  await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 15_000,
    distanceInterval: 25,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: "AgriLink — entrega em curso",
      notificationBody:
        "A localização está a ser partilhada com o comprador durante esta entrega.",
      notificationColor: "#176B45",
      killServiceOnDestroy: false,
    },
  });
}

export async function requestAndStartDriverTracking(
  activeLoadIds: string[],
): Promise<void> {
  const uniqueLoadIds = [...new Set(activeLoadIds.filter(Boolean))];
  if (uniqueLoadIds.length === 0) {
    throw new Error("Não existem cargas em trânsito atribuídas a este motorista.");
  }

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) {
    throw new Error("É necessária permissão de localização precisa em primeiro plano.");
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (!background.granted) {
    throw new Error(
      "A permissão de localização em segundo plano é necessária para continuar com o ecrã bloqueado. Active-a nas definições do Android.",
    );
  }

  const notification = await Notifications.requestPermissionsAsync();
  if (!notification.granted) {
    throw new Error(
      "Permita as notificações para que o Android apresente o aviso permanente do serviço de localização.",
    );
  }

  await replaceActiveTrackingLoadIds(uniqueLoadIds);
  await setTrackingConsent(true);
  await startForegroundLocationService();
  await flushLocationOutbox();
}

export async function reconcileDriverTracking(
  activeLoadIds: string[],
): Promise<void> {
  const uniqueLoadIds = [...new Set(activeLoadIds.filter(Boolean))];
  await replaceActiveTrackingLoadIds(uniqueLoadIds);

  if (uniqueLoadIds.length === 0) {
    if (await isDriverLocationServiceRunning()) {
      await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
    }
    await flushLocationOutbox();
    return;
  }

  if (!(await getTrackingConsent())) return;

  const foreground = await Location.getForegroundPermissionsAsync();
  const background = await Location.getBackgroundPermissionsAsync();
  const notification = await Notifications.getPermissionsAsync();

  if (!foreground.granted || !background.granted || !notification.granted) {
    return;
  }

  await startForegroundLocationService();
  await flushLocationOutbox();
}
