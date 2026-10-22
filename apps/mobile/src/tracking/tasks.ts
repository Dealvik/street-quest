import * as BackgroundFetch from "expo-background-fetch";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { recordPoints, syncPending } from "./pipeline";

export const LOCATION_TASK = "street-quest-location";
export const SYNC_TASK = "street-quest-sync";

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const locations = (data as { locations?: Location.LocationObject[] }).locations ?? [];
  await recordPoints(locations.map(locationToPoint));
});

TaskManager.defineTask(SYNC_TASK, async () => {
  try {
    const result = await syncPending();
    return result.uploaded > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export function locationToPoint(location: Location.LocationObject) {
  return {
    clientId: `${location.timestamp}-${Math.random().toString(36).slice(2, 10)}`,
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    altitude: location.coords.altitude,
    accuracyMeters: location.coords.accuracy,
    speedMps: location.coords.speed,
    recordedAt: new Date(location.timestamp).toISOString(),
  };
}

export async function registerSyncTask(): Promise<void> {
  const registered = await TaskManager.isTaskRegisteredAsync(SYNC_TASK);
  if (registered) return;
  const status = await BackgroundFetch.getStatusAsync();
  if (
    status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
    status === BackgroundFetch.BackgroundFetchStatus.Denied
  ) {
    return;
  }
  await BackgroundFetch.registerTaskAsync(SYNC_TASK, {
    minimumInterval: 15 * 60,
    stopOnTerminate: false,
    startOnBoot: true,
  });
}
