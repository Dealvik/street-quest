import { H3_RESOLUTION, MAX_DWELL_GAP_SECONDS } from "./constants";
import { cellKind, coverageIntensity, styleForIntensity } from "./glow";
import { haversineMeters } from "./haversine";
import { cellCentroid, cellFor, cellRing } from "./h3";
import type { CoverageCell, CoverageModel, TrackPoint } from "./types";

export function decorateCell(input: {
  h3Index: string;
  resolution: number;
  durationSeconds: number;
  visitCount: number;
  pointCount: number;
  firstSeen: string;
  lastSeen: string;
  centroid: [number, number];
  polygon: [number, number][];
}): CoverageCell {
  const intensity = coverageIntensity(input.durationSeconds);
  const style = styleForIntensity(intensity);
  return {
    ...input,
    kind: cellKind(input.durationSeconds),
    intensity,
    fill: style.fill,
    line: style.line,
    opacity: style.opacity,
    lineWidth: style.lineWidth,
  };
}

type Draft = {
  h3Index: string;
  durationSeconds: number;
  visitCount: number;
  pointCount: number;
  firstSeenMs: number;
  lastSeenMs: number;
};

/**
 * Group consecutive kept fixes that fall in the same H3 cell.
 * Time counts only while both ends of a gap are in that cell and the gap is
 * short enough to be presence, not a GPS outage.
 */
export function coverageFromPoints(points: readonly TrackPoint[]): CoverageModel {
  const sorted = [...points].sort(
    (a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt),
  );
  const drafts = new Map<string, Draft>();
  let distanceMeters = 0;
  let previous: TrackPoint | undefined;

  for (const point of sorted) {
    const recordedMs = Date.parse(point.recordedAt);
    const h3Index = cellFor(point.latitude, point.longitude);
    const draft = drafts.get(h3Index) ?? {
      h3Index,
      durationSeconds: 0,
      visitCount: 0,
      pointCount: 0,
      firstSeenMs: recordedMs,
      lastSeenMs: recordedMs,
    };
    draft.pointCount += 1;
    draft.firstSeenMs = Math.min(draft.firstSeenMs, recordedMs);
    draft.lastSeenMs = Math.max(draft.lastSeenMs, recordedMs);

    if (previous) {
      distanceMeters += haversineMeters(previous, point);
      const dt = (recordedMs - Date.parse(previous.recordedAt)) / 1000;
      const previousCell = cellFor(previous.latitude, previous.longitude);
      const sameCell = previousCell === h3Index;
      if (sameCell && dt > 0 && dt <= MAX_DWELL_GAP_SECONDS) {
        draft.durationSeconds += dt;
      }
      if (!sameCell || dt > MAX_DWELL_GAP_SECONDS) {
        draft.visitCount += 1;
      }
    } else {
      draft.visitCount = 1;
    }

    drafts.set(h3Index, draft);
    previous = point;
  }

  const cells = [...drafts.values()]
    .map((draft) => finalizeDraft(draft))
    .sort((a, b) => b.durationSeconds - a.durationSeconds || a.h3Index.localeCompare(b.h3Index));

  return {
    cells,
    distanceMeters,
    durationSeconds: cells.reduce((sum, cell) => sum + cell.durationSeconds, 0),
  };
}

function finalizeDraft(draft: Draft): CoverageCell {
  return decorateCell({
    h3Index: draft.h3Index,
    resolution: H3_RESOLUTION,
    durationSeconds: draft.durationSeconds,
    visitCount: draft.visitCount,
    pointCount: draft.pointCount,
    firstSeen: new Date(draft.firstSeenMs).toISOString(),
    lastSeen: new Date(draft.lastSeenMs).toISOString(),
    centroid: cellCentroid(draft.h3Index),
    polygon: cellRing(draft.h3Index),
  });
}

export function mergeCells(groups: readonly (readonly CoverageCell[])[]): CoverageCell[] {
  const byIndex = new Map<string, CoverageCell>();
  for (const group of groups) {
    for (const cell of group) {
      const previous = byIndex.get(cell.h3Index);
      if (!previous || cell.durationSeconds > previous.durationSeconds) {
        byIndex.set(cell.h3Index, cell);
      }
    }
  }
  return [...byIndex.values()].sort(
    (a, b) => b.durationSeconds - a.durationSeconds || a.h3Index.localeCompare(b.h3Index),
  );
}
