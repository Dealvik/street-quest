import type { ActivityMode, ActivitySnapshot } from "./types";

const MEDIUM_CONFIDENCE = 1;

function confident(activity: { detected: boolean; confidence: number } | undefined): boolean {
  return Boolean(activity?.detected && activity.confidence >= MEDIUM_CONFIDENCE);
}

/**
 * Moving wins over stationary. Low-confidence readings stay unknown so the
 * tracker does not pause GPS on a guess.
 */
export function activityMode(snapshot: ActivitySnapshot | null | undefined): ActivityMode {
  if (!snapshot) return "unknown";
  if (
    confident(snapshot.walking) ||
    confident(snapshot.running) ||
    confident(snapshot.cycling) ||
    confident(snapshot.automotive)
  ) {
    return "moving";
  }
  if (confident(snapshot.stationary)) return "stationary";
  return "unknown";
}
