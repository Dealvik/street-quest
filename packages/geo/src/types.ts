export type TrackPoint = {
  clientId: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracyMeters: number | null;
  speedMps: number | null;
  recordedAt: string;
};

export type DropReason =
  | "invalid"
  | "accuracy"
  | "duplicate-time"
  | "teleport"
  | "stationary";

export type FilterResult = {
  kept: TrackPoint[];
  dropped: Array<{ point: TrackPoint; reason: DropReason }>;
};

export type CellKind = "passage" | "sojourn";

export type CoverageCell = {
  h3Index: string;
  resolution: number;
  durationSeconds: number;
  visitCount: number;
  pointCount: number;
  firstSeen: string;
  lastSeen: string;
  kind: CellKind;
  intensity: number;
  fill: string;
  line: string;
  opacity: number;
  lineWidth: number;
  centroid: [number, number];
  polygon: [number, number][];
};

export type CoverageModel = {
  cells: CoverageCell[];
  distanceMeters: number;
  durationSeconds: number;
};

export type BBox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type ActivitySnapshot = {
  stationary?: { detected: boolean; confidence: number };
  walking?: { detected: boolean; confidence: number };
  running?: { detected: boolean; confidence: number };
  cycling?: { detected: boolean; confidence: number };
  automotive?: { detected: boolean; confidence: number };
};

export type ActivityMode = "moving" | "stationary" | "unknown";

export type Waypoint = {
  latitude: number;
  longitude: number;
  /** Seconds to remain here, recorded as low-rate heartbeats. */
  dwellSeconds?: number;
};
