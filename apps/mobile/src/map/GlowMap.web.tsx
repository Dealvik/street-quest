import {
  boundsOfCells,
  cellsToPoints,
  cellsToPolygons,
  DARK_MAP_STYLE,
  FOG_MASK,
  LONG_MEADOW_CENTER,
  type BBox,
  type CoverageCell,
} from "@street-quest/geo";
import { Map as MlMap, NavigationControl, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { theme } from "../theme";
import { bloomPaint, fillPaint, glowPaint, linePaint } from "./paint";
import "maplibre-gl/dist/maplibre-gl.css";

setWorkerUrl("https://cdn.jsdelivr.net/npm/maplibre-gl@6.15.0/dist/maplibre-gl-worker.mjs");

type Props = {
  cells: CoverageCell[];
  focusToken: number;
  onViewport: (bbox: BBox) => void;
};

export function GlowMap({ cells, focusToken, onViewport }: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const fitted = useRef<number | null>(null);
  const [failed, setFailed] = useState(false);
  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const viewportRef = useRef(onViewport);
  viewportRef.current = onViewport;

  useEffect(() => {
    const node = host.current;
    if (!node || mapRef.current) return;
    const map = new MlMap({
      container: node,
      style: DARK_MAP_STYLE,
      center: [LONG_MEADOW_CENTER.longitude, LONG_MEADOW_CENTER.latitude],
      zoom: 14,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("error", (event) => {
      const message = event.error?.message ?? "";
      if (/worker|webgl|failed to load/i.test(message)) setFailed(true);
    });
    map.on("load", () => {
      map.addSource("fog", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [FOG_MASK] },
      });
      map.addLayer({
        id: "fog-fill",
        type: "fill",
        source: "fog",
        paint: { "fill-color": "#050705", "fill-opacity": 0.42 },
      });
      map.addSource("coverage", { type: "geojson", data: cellsToPolygons(cellsRef.current) });
      map.addLayer({ id: "coverage-fill", type: "fill", source: "coverage", paint: fillPaint as never });
      map.addLayer({ id: "coverage-glow", type: "line", source: "coverage", paint: glowPaint as never });
      map.addLayer({ id: "coverage-line", type: "line", source: "coverage", paint: linePaint as never });
      map.addSource("bloom", { type: "geojson", data: cellsToPoints(cellsRef.current) });
      map.addLayer({ id: "coverage-bloom", type: "circle", source: "bloom", paint: bloomPaint as never });
      const publish = () => {
        const bounds = map.getBounds();
        viewportRef.current({
          west: bounds.getWest(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          north: bounds.getNorth(),
        });
      };
      map.on("moveend", publish);
      publish();
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const polygons = map.getSource("coverage") as GeoJSONSource | undefined;
    const points = map.getSource("bloom") as GeoJSONSource | undefined;
    polygons?.setData(cellsToPolygons(cells));
    points?.setData(cellsToPoints(cells));
  }, [cells]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitted.current === focusToken) return;
    const bounds = boundsOfCells(cells);
    if (!bounds) return;
    map.fitBounds(
      [
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
      ],
      { padding: 72, maxZoom: 16, duration: 700 },
    );
    fitted.current = focusToken;
  }, [cells, focusToken]);

  if (failed) {
    return (
      <View style={styles.frame}>
        <SvgCoverage cells={cells} />
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <div ref={host} style={{ position: "absolute", inset: 0 }} />
    </View>
  );
}

function SvgCoverage({ cells }: { cells: CoverageCell[] }) {
  const bounds = boundsOfCells(cells);
  const width = 440;
  const height = 720;
  const padded = bounds
    ? {
        west: bounds.west - (bounds.east - bounds.west) * 0.18,
        east: bounds.east + (bounds.east - bounds.west) * 0.18,
        south: bounds.south - (bounds.north - bounds.south) * 0.18,
        north: bounds.north + (bounds.north - bounds.south) * 0.18,
      }
    : null;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "100%", background: "#070a07" }}>
      <defs>
        <filter id="cell-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {padded
        ? cells.map((cell) => (
            <polygon
              key={cell.h3Index}
              points={cell.polygon
                .map(([longitude, latitude]) => project(longitude, latitude, padded, width, height).join(","))
                .join(" ")}
              fill={cell.fill}
              fillOpacity={cell.opacity}
              stroke={cell.line}
              strokeWidth={cell.lineWidth}
              filter="url(#cell-glow)"
            />
          ))
        : null}
    </svg>
  );
}

function project(longitude: number, latitude: number, bounds: BBox, width: number, height: number): [number, number] {
  const x = ((longitude - bounds.west) / (bounds.east - bounds.west)) * width;
  const y = ((bounds.north - latitude) / (bounds.north - bounds.south)) * height;
  return [x, y];
}

const styles = StyleSheet.create({
  frame: { flex: 1, backgroundColor: theme.fog },
});
