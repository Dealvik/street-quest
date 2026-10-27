import {
  DARK_MAP_STYLE,
  FOG_COLOR,
  FOG_MASK,
  FOG_OPACITY,
  trailToLines,
  type BBox,
  type TrailSegment,
} from "@street-quest/geo";
import { Map as MlMap, NavigationControl, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { theme } from "../theme";
import { LocateButton } from "./LocateButton";
import { lineLayout, trailGlowPaint, trailLinePaint, userDotPaint } from "./paint";
import "maplibre-gl/dist/maplibre-gl.css";

setWorkerUrl("https://cdn.jsdelivr.net/npm/maplibre-gl@6.15.0/dist/maplibre-gl-worker.mjs");

type LngLat = { longitude: number; latitude: number };

type Props = {
  segments: TrailSegment[];
  user: LngLat | null;
  onViewport: (bbox: BBox) => void;
};

const emptyCollection = { type: "FeatureCollection" as const, features: [] };

export function GlowMap({ segments, user, onViewport }: Props) {
  const host = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const userRef = useRef(user);
  const followingRef = useRef(true);
  const centered = useRef(false);
  const [following, setFollowing] = useState(true);
  const [failed, setFailed] = useState(false);
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  userRef.current = user;
  const viewportRef = useRef(onViewport);
  viewportRef.current = onViewport;

  function releaseFollow() {
    if (!followingRef.current) return;
    followingRef.current = false;
    setFollowing(false);
  }
  const releaseRef = useRef(releaseFollow);
  releaseRef.current = releaseFollow;

  function recenter() {
    followingRef.current = true;
    setFollowing(true);
    const map = mapRef.current;
    const current = userRef.current;
    if (!map || !current) return;
    map.jumpTo({
      center: [current.longitude, current.latitude],
      zoom: Math.max(map.getZoom(), 16),
    });
    centered.current = true;
  }

  useEffect(() => {
    const node = host.current;
    if (!node || mapRef.current) return;
    const map = new MlMap({
      container: node,
      style: DARK_MAP_STYLE,
      center: [0, 20],
      zoom: 2,
      pitch: 0,
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("error", (event) => {
      const message = event.error?.message ?? "";
      if (/worker|webgl|failed to load/i.test(message)) setFailed(true);
    });
    const onGesture = (event: { originalEvent?: unknown }) => {
      if (event.originalEvent) releaseRef.current();
    };
    map.on("dragstart", onGesture);
    map.on("zoomstart", onGesture);
    map.on("rotatestart", onGesture);
    map.on("pitchstart", onGesture);
    map.on("load", () => {
      map.addSource("fog", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [FOG_MASK] },
      });
      map.addLayer({
        id: "fog-fill",
        type: "fill",
        source: "fog",
        paint: { "fill-color": FOG_COLOR, "fill-opacity": FOG_OPACITY },
      });
      map.addSource("trail", { type: "geojson", data: trailToLines(segmentsRef.current) });
      map.addLayer({
        id: "trail-glow",
        type: "line",
        source: "trail",
        layout: lineLayout as never,
        paint: trailGlowPaint as never,
      });
      map.addLayer({
        id: "trail-line",
        type: "line",
        source: "trail",
        layout: lineLayout as never,
        paint: trailLinePaint as never,
      });
      map.addSource("user", { type: "geojson", data: userPoint(userRef.current) });
      map.addLayer({ id: "user-dot", type: "circle", source: "user", paint: userDotPaint as never });
      const current = userRef.current;
      if (current && followingRef.current) {
        map.jumpTo({ center: [current.longitude, current.latitude], zoom: 16 });
        centered.current = true;
      }
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
    (map?.getSource("trail") as GeoJSONSource | undefined)?.setData(trailToLines(segments));
  }, [segments]);

  useEffect(() => {
    const map = mapRef.current;
    (map?.getSource("user") as GeoJSONSource | undefined)?.setData(userPoint(user));
    if (!map || !user || !followingRef.current) return;
    map.easeTo({
      center: [user.longitude, user.latitude],
      zoom: map.getZoom() < 14 ? 16 : map.getZoom(),
      duration: centered.current ? 450 : 0,
    });
    centered.current = true;
  }, [user]);

  if (failed) {
    return (
      <View style={styles.frame}>
        <SvgTrail segments={segments} user={user} />
        <LocateButton following={following} onPress={recenter} />
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <div ref={host} style={{ position: "absolute", inset: 0, zIndex: 0 }} />
      <LocateButton following={following} onPress={recenter} />
    </View>
  );
}

function userPoint(user: LngLat | null) {
  if (!user) return emptyCollection;
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "Point" as const, coordinates: [user.longitude, user.latitude] as [number, number] },
      },
    ],
  };
}

function SvgTrail({ segments, user }: { segments: TrailSegment[]; user: LngLat | null }) {
  const width = 440;
  const height = 720;
  const points = segments.flatMap((segment) => segment.coordinates);
  if (user) points.push([user.longitude, user.latitude]);
  const bounds = boundsOf(points);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "100%", background: "#10140f" }}>
      <rect width={width} height={height} fill={FOG_COLOR} opacity={FOG_OPACITY} />
      {bounds
        ? segments.map((segment) => {
            const [start, end] = segment.coordinates;
            const [x1, y1] = project(start[0], start[1], bounds, width, height);
            const [x2, y2] = project(end[0], end[1], bounds, width, height);
            return (
              <line
                key={segment.id}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={segment.line}
                strokeWidth={segment.lineWidth}
                strokeOpacity={segment.opacity}
                strokeLinecap="round"
              />
            );
          })
        : null}
      {bounds && user ? (
        <circle
          cx={project(user.longitude, user.latitude, bounds, width, height)[0]}
          cy={project(user.longitude, user.latitude, bounds, width, height)[1]}
          r={7}
          fill="#d6ff4a"
          stroke="#10140f"
          strokeWidth={2}
        />
      ) : null}
    </svg>
  );
}

function boundsOf(points: [number, number][]): BBox | null {
  if (points.length === 0) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [longitude, latitude] of points) {
    west = Math.min(west, longitude);
    east = Math.max(east, longitude);
    south = Math.min(south, latitude);
    north = Math.max(north, latitude);
  }
  if (east - west < 0.002) {
    west -= 0.002;
    east += 0.002;
  }
  if (north - south < 0.002) {
    south -= 0.002;
    north += 0.002;
  }
  return { west, south, east, north };
}

function project(longitude: number, latitude: number, bounds: BBox, width: number, height: number): [number, number] {
  const x = ((longitude - bounds.west) / (bounds.east - bounds.west)) * width;
  const y = ((bounds.north - latitude) / (bounds.north - bounds.south)) * height;
  return [x, y];
}

const styles = StyleSheet.create({
  frame: { flex: 1, position: "relative", backgroundColor: theme.fog },
});
