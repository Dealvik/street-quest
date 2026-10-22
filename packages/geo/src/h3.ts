import { cellToBoundary, cellToLatLng, latLngToCell } from "h3-js";
import { H3_RESOLUTION } from "./constants";

export function cellFor(latitude: number, longitude: number, resolution = H3_RESOLUTION): string {
  return latLngToCell(latitude, longitude, resolution);
}

/** Closed GeoJSON ring, [longitude, latitude]. */
export function cellRing(h3Index: string): [number, number][] {
  const boundary = cellToBoundary(h3Index, true) as [number, number][];
  const ring = boundary.map((pair) => [pair[0], pair[1]] as [number, number]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && (!last || first[0] !== last[0] || first[1] !== last[1])) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}

/** [longitude, latitude] */
export function cellCentroid(h3Index: string): [number, number] {
  const [latitude, longitude] = cellToLatLng(h3Index);
  return [longitude, latitude];
}
