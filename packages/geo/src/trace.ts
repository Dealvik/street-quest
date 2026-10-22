import { LONG_MEADOW_CENTER, STATIONARY_HEARTBEAT_SECONDS } from "./constants";
import { haversineMeters, interpolate } from "./haversine";
import type { TrackPoint, Waypoint } from "./types";

export const LONG_MEADOW_WAYPOINTS: Waypoint[] = [
  { latitude: 40.67355, longitude: -73.97035 },
  { latitude: 40.67105, longitude: -73.97015 },
  { latitude: 40.6684, longitude: -73.97005 },
  { latitude: LONG_MEADOW_CENTER.latitude, longitude: LONG_MEADOW_CENTER.longitude, dwellSeconds: 360 },
  { latitude: 40.6628, longitude: -73.9714 },
  { latitude: 40.6634, longitude: -73.9758 },
  { latitude: 40.6679, longitude: -73.9762 },
  { latitude: 40.6722, longitude: -73.9734 },
];

type TraceOptions = {
  idPrefix?: string;
  speedMps?: number;
  sampleMeters?: number;
  accuracyMeters?: number;
  startAt?: string;
  heartbeatSeconds?: number;
};

export function traceFromWaypoints(waypoints: readonly Waypoint[], options: TraceOptions = {}): TrackPoint[] {
  if (waypoints.length === 0) return [];
  const speedMps = options.speedMps ?? 1.35;
  const sampleMeters = options.sampleMeters ?? 13;
  const accuracyMeters = options.accuracyMeters ?? 6;
  const heartbeatSeconds = options.heartbeatSeconds ?? STATIONARY_HEARTBEAT_SECONDS;
  const idPrefix = options.idPrefix ?? "trace";
  let clock = Date.parse(options.startAt ?? "2026-06-14T14:00:00.000Z");
  let index = 0;

  const points: TrackPoint[] = [];
  const push = (
    latitude: number,
    longitude: number,
    speed: number,
    stepSeconds: number,
  ) => {
    clock += Math.round(stepSeconds * 1000);
    points.push({
      clientId: `${idPrefix}-${String(index).padStart(4, "0")}`,
      latitude,
      longitude,
      altitude: 18,
      accuracyMeters,
      speedMps: speed,
      recordedAt: new Date(clock).toISOString(),
    });
    index += 1;
  };

  const first = waypoints[0];
  if (!first) return points;
  push(first.latitude, first.longitude, speedMps, 0);

  for (let waypointIndex = 1; waypointIndex < waypoints.length; waypointIndex += 1) {
    const from = waypoints[waypointIndex - 1];
    const to = waypoints[waypointIndex];
    if (!from || !to) continue;
    const distance = haversineMeters(from, to);
    const steps = Math.max(1, Math.round(distance / sampleMeters));
    const stepDistance = distance / steps;
    for (let step = 1; step <= steps; step += 1) {
      const point = interpolate(from, to, step / steps);
      push(point.latitude, point.longitude, speedMps, stepDistance / speedMps);
    }
    const dwell = to.dwellSeconds ?? 0;
    let elapsed = 0;
    while (elapsed + heartbeatSeconds <= dwell) {
      elapsed += heartbeatSeconds;
      push(to.latitude, to.longitude, 0, heartbeatSeconds);
    }
  }

  return points;
}

export function longMeadowRoam(): TrackPoint[] {
  return traceFromWaypoints(LONG_MEADOW_WAYPOINTS, { idPrefix: "long-meadow" });
}
