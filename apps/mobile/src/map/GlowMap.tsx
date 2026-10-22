import {
  boundsOfCells,
  cellsToPoints,
  cellsToPolygons,
  DARK_MAP_STYLE,
  FOG_MASK,
  LONG_MEADOW_CENTER,
  type CoverageCell,
} from "@street-quest/geo";
import { Camera, GeoJSONSource, Layer, Map } from "@maplibre/maplibre-react-native";
import { StyleSheet, View } from "react-native";
import { bloomPaint, fillPaint, glowPaint, linePaint } from "./paint";

type BBox = { west: number; south: number; east: number; north: number };

type Props = {
  cells: CoverageCell[];
  focusToken: number;
  onViewport: (bbox: BBox) => void;
};

export function GlowMap({ cells, focusToken, onViewport }: Props) {
  const bounds = boundsOfCells(cells);
  const center: [number, number] = bounds
    ? [(bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2]
    : [LONG_MEADOW_CENTER.longitude, LONG_MEADOW_CENTER.latitude];

  return (
    <View style={styles.frame}>
      <Map
        style={styles.map}
        mapStyle={DARK_MAP_STYLE}
        onRegionDidChange={(event) => {
          const [west, south, east, north] = event.nativeEvent.bounds;
          onViewport({ west, south, east, north });
        }}
      >
        <Camera key={focusToken} initialViewState={{ center, zoom: bounds ? 15 : 14 }} />
        <GeoJSONSource id="fog" data={{ type: "FeatureCollection", features: [FOG_MASK] }}>
          <Layer id="fog-fill" type="fill" source="fog" paint={{ "fill-color": "#050705", "fill-opacity": 0.42 }} />
        </GeoJSONSource>
        <GeoJSONSource id="coverage" data={cellsToPolygons(cells)}>
          <Layer id="coverage-fill" type="fill" source="coverage" paint={fillPaint as never} />
          <Layer id="coverage-glow" type="line" source="coverage" paint={glowPaint as never} />
          <Layer id="coverage-line" type="line" source="coverage" paint={linePaint as never} />
        </GeoJSONSource>
        <GeoJSONSource id="bloom" data={cellsToPoints(cells)}>
          <Layer id="coverage-bloom" type="circle" source="bloom" paint={bloomPaint as never} />
        </GeoJSONSource>
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  map: { flex: 1 },
});
