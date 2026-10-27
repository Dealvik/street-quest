import type { TrailSegment } from "./trail";
import type { BBox, CoverageCell } from "./types";

/** Unvisited ground. Light enough that streets still read, dark enough to stay unexplored. */
export const FOG_COLOR = "#050705";
export const FOG_OPACITY = 0.24;

export type JsonFeatureCollection = {
  type: "FeatureCollection";
  features: JsonFeature[];
};

export type JsonFeature = {
  type: "Feature";
  properties: Record<string, string | number>;
  geometry:
    | { type: "Polygon"; coordinates: [number, number][][] }
    | { type: "LineString"; coordinates: [number, number][] }
    | { type: "Point"; coordinates: [number, number] };
};

export function cellsToPolygons(cells: readonly CoverageCell[]): JsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: cells.map((cell) => ({
      type: "Feature",
      properties: propertiesOf(cell),
      geometry: { type: "Polygon", coordinates: [cell.polygon] },
    })),
  };
}

export function cellsToPoints(cells: readonly CoverageCell[]): JsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: cells.map((cell) => ({
      type: "Feature",
      properties: propertiesOf(cell),
      geometry: { type: "Point", coordinates: cell.centroid },
    })),
  };
}

export function trailToLines(segments: readonly TrailSegment[]): JsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: segments.map((segment) => ({
      type: "Feature",
      properties: {
        id: segment.id,
        durationSeconds: segment.durationSeconds,
        line: segment.line,
        opacity: segment.opacity,
        lineWidth: segment.lineWidth,
      },
      geometry: { type: "LineString", coordinates: segment.coordinates },
    })),
  };
}

function propertiesOf(cell: CoverageCell): Record<string, string | number> {
  return {
    h3Index: cell.h3Index,
    durationSeconds: cell.durationSeconds,
    visitCount: cell.visitCount,
    kind: cell.kind,
    intensity: cell.intensity,
    fill: cell.fill,
    line: cell.line,
    opacity: cell.opacity,
    lineWidth: cell.lineWidth,
  };
}

export const FOG_MASK: JsonFeature = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-180, -85],
        [180, -85],
        [180, 85],
        [-180, 85],
        [-180, -85],
      ],
    ],
  },
};

export function boundsOfCells(cells: readonly CoverageCell[]): BBox | null {
  if (cells.length === 0) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const cell of cells) {
    for (const [longitude, latitude] of cell.polygon) {
      west = Math.min(west, longitude);
      east = Math.max(east, longitude);
      south = Math.min(south, latitude);
      north = Math.max(north, latitude);
    }
  }
  return { west, south, east, north };
}

export function cellInBBox(cell: CoverageCell, bbox: BBox): boolean {
  const [longitude, latitude] = cell.centroid;
  return (
    longitude >= bbox.west &&
    longitude <= bbox.east &&
    latitude >= bbox.south &&
    latitude <= bbox.north
  );
}
