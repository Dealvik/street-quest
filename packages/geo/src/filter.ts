import {
  MAX_ACCURACY_METERS,
  MAX_IMPLIED_SPEED_MPS,
  MIN_SAMPLE_DISTANCE_METERS,
  STATIONARY_HEARTBEAT_SECONDS,
  TELEPORT_WINDOW_SECONDS,
} from "./constants";
import { haversineMeters } from "./haversine";
import type { DropReason, FilterResult, TrackPoint } from "./types";

function validPoint(point: TrackPoint): boolean {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return false;
  if (point.latitude < -90 || point.latitude > 90) return false;
  if (point.longitude < -180 || point.longitude > 180) return false;
  return Number.isFinite(Date.parse(point.recordedAt));
}

/**
 * Decide whether a fix is worth keeping, given the previous kept fix.
 * Stationary devices emit at most one heartbeat per minute. Short, impossible
 * jumps are dropped. A long gap, even across a large distance, starts a new
 * segment so a later trip is not discarded.
 */
export function rejectionReason(point: TrackPoint, previous: TrackPoint | undefined): DropReason | null {
  if (!validPoint(point)) return "invalid";
  if (point.accuracyMeters != null && point.accuracyMeters > MAX_ACCURACY_METERS) return "accuracy";
  if (!previous) return null;

  const dt = (Date.parse(point.recordedAt) - Date.parse(previous.recordedAt)) / 1000;
  if (dt <= 0) return "duplicate-time";

  const distance = haversineMeters(previous, point);
  const implied = distance / dt;
  if (implied > MAX_IMPLIED_SPEED_MPS && dt <= TELEPORT_WINDOW_SECONDS) return "teleport";
  if (distance < MIN_SAMPLE_DISTANCE_METERS && dt < STATIONARY_HEARTBEAT_SECONDS) return "stationary";
  return null;
}

export function filterTrack(points: readonly TrackPoint[]): FilterResult {
  const sorted = [...points].sort(
    (a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt),
  );
  const kept: TrackPoint[] = [];
  const dropped: FilterResult["dropped"] = [];
  for (const point of sorted) {
    const reason = rejectionReason(point, kept[kept.length - 1]);
    if (reason) dropped.push({ point, reason });
    else kept.push(point);
  }
  return { kept, dropped };
}
