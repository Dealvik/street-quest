import { MAX_DWELL_GAP_SECONDS } from "./constants";
import { coverageIntensity, styleForIntensity } from "./glow";
import { haversineMeters } from "./haversine";
import type { TrackPoint } from "./types";

/** Do not draw a straight chord across a missed turn or a GPS jump. */
const MAX_CHORD_METERS = 120;

export type TrailSegment = {
  id: string;
  coordinates: [[number, number], [number, number]];
  durationSeconds: number;
  line: string;
  opacity: number;
  lineWidth: number;
};

/**
 * A street line is the walked path: each kept fix connects to the next.
 * A long pause or a jump starts a new piece, so the map does not slash across the gap.
 */
export function trailFromPoints(points: readonly TrackPoint[]): TrailSegment[] {
  const ordered = [...points].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.clientId.localeCompare(b.clientId));
  const segments: TrailSegment[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const next = ordered[index];
    if (!previous || !next) continue;
    const durationSeconds = (Date.parse(next.recordedAt) - Date.parse(previous.recordedAt)) / 1000;
    if (!Number.isFinite(durationSeconds) || durationSeconds < 0 || durationSeconds > MAX_DWELL_GAP_SECONDS) {
      continue;
    }
    if (haversineMeters(previous, next) > MAX_CHORD_METERS) continue;
    const style = styleForIntensity(coverageIntensity(durationSeconds));
    segments.push({
      id: `${previous.clientId}:${next.clientId}`,
      coordinates: [
        [previous.longitude, previous.latitude],
        [next.longitude, next.latitude],
      ],
      durationSeconds,
      line: style.line,
      opacity: style.opacity,
      lineWidth: style.lineWidth,
    });
  }
  return segments;
}
