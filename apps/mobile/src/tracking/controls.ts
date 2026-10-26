import {
  activityMode,
  MIN_SAMPLE_DISTANCE_METERS,
  STATIONARY_HEARTBEAT_SECONDS,
  type ActivityMode,
} from "@street-quest/geo";
import * as Location from "expo-location";
import { Platform } from "react-native";
import { useTrail } from "../trail";
import { recordPoints } from "./pipeline";
import { LOCATION_TASK, locationToPoint, registerSyncTask } from "./tasks";

const notification = {
  notificationTitle: "Street Quest",
  notificationBody: "Keeping a low-power trail of where you walk.",
  notificationColor: "#d6ff4a",
};

let motionSubscription: Location.LocationSubscription | null = null;
let webWatch: Location.LocationSubscription | null = null;
let appliedMode: ActivityMode | null = null;
let inflight: Promise<void> | null = null;
let epoch = 0;

export function optionsFor(mode: ActivityMode): Location.LocationTaskOptions {
  const moving = mode !== "stationary";
  return {
    accuracy: moving ? Location.Accuracy.High : Location.Accuracy.Balanced,
    distanceInterval: moving ? MIN_SAMPLE_DISTANCE_METERS : 30,
    timeInterval: moving ? 5_000 : STATIONARY_HEARTBEAT_SECONDS * 1000,
    deferredUpdatesDistance: moving ? MIN_SAMPLE_DISTANCE_METERS : 30,
    deferredUpdatesInterval: moving ? 15_000 : STATIONARY_HEARTBEAT_SECONDS * 1000,
    pausesUpdatesAutomatically: true,
    activityType: moving ? Location.ActivityType.Fitness : Location.ActivityType.Other,
    showsBackgroundLocationIndicator: true,
    foregroundService: notification,
  };
}

export async function ensureTracking(): Promise<void> {
  if (useTrail.getState().tracking && (Platform.OS !== "web" || webWatch)) return;
  if (inflight) return inflight;
  const ticket = epoch;
  inflight = runTracking(ticket).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function runTracking(ticket: number): Promise<void> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (ticket !== epoch) return;
  if (foreground.status !== Location.PermissionStatus.GRANTED) {
    useTrail.getState().setTracking(false);
    useTrail.getState().setStatus("Location permission is off. Street Quest records where you walk.");
    return;
  }
  if (Platform.OS !== "web") {
    const background = await Location.requestBackgroundPermissionsAsync();
    if (ticket !== epoch) return;
    if (background.status !== Location.PermissionStatus.GRANTED) {
      useTrail.getState().setStatus("Background location is off. The trail runs while the app is open.");
    }
  }

  await restartUpdates("unknown");
  if (ticket !== epoch) return;
  useTrail.getState().setTracking(true);
  if (!useTrail.getState().status.startsWith("Background")) {
    useTrail.getState().setStatus("Stillness slows the GPS. Walking samples about every 12 meters.");
  }

  if (Platform.OS === "web") {
    try {
      webWatch = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: MIN_SAMPLE_DISTANCE_METERS,
          timeInterval: 5_000,
        },
        (location) => {
          useTrail.getState().setUser({
            longitude: location.coords.longitude,
            latitude: location.coords.latitude,
          });
          void recordPoints([locationToPoint(location)]);
        },
      );
    } catch {
      if (ticket !== epoch) return;
      useTrail.getState().setTracking(false);
      useTrail.getState().setStatus("Location permission is off. Street Quest records where you walk.");
      return;
    }
    if (ticket !== epoch) {
      webWatch.remove();
      webWatch = null;
    }
    return;
  }

  try {
    motionSubscription = await Location.watchMotionActivityAsync((activity) => {
      const mode = activityMode({
        stationary: activity.activities.stationary,
        walking: activity.activities.walking,
        running: activity.activities.running,
        cycling: activity.activities.cycling,
        automotive: activity.activities.automotive,
      });
      if (mode !== "unknown" && mode !== appliedMode) {
        void restartUpdates(mode);
      }
    });
  } catch {
    // Motion hardware is optional. Distance filtering still drops stationary noise.
  }
  if (ticket !== epoch) {
    motionSubscription?.remove();
    motionSubscription = null;
    return;
  }
  try {
    await registerSyncTask();
  } catch {
    // Background fetch is unavailable in Expo Go and on web. Manual sync still runs.
  }
}

export async function stopTracking(): Promise<void> {
  epoch += 1;
  inflight = null;
  webWatch?.remove();
  webWatch = null;
  motionSubscription?.remove();
  motionSubscription = null;
  appliedMode = null;
  if (Platform.OS !== "web") {
    try {
      if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK);
      }
    } catch {
      // The background task is already stopped.
    }
  }
  useTrail.getState().setTracking(false);
  useTrail.getState().setStatus("");
}

async function restartUpdates(mode: ActivityMode): Promise<void> {
  appliedMode = mode;
  if (Platform.OS === "web") return;
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (started) await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  await Location.startLocationUpdatesAsync(LOCATION_TASK, optionsFor(mode));
}
